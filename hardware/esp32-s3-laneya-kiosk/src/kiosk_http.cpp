#include "kiosk_http.h"
#include "wifi_manager.h"
#include "drop_sensor.h"
#include "cam_link.h"
#include "dispenser.h"
#include "kiosk_session.h"

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include "kiosk_page.h"

#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#endif

static WebServer server(80);

static const char* phaseName(KioskPhase p) {
  switch (p) {
    case KIOSK_IDLE: return "idle";
    case KIOSK_SCANNING: return "scanning";
    case KIOSK_PREVIEW: return "preview";
    case KIOSK_DISPENSING: return "dispensing";
    case KIOSK_SUCCESS: return "success";
    case KIOSK_ERROR: return "error";
    default: return "idle";
  }
}

static void sendCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, X-Kiosk-Secret");
}

static void handleOptions() {
  sendCorsHeaders();
  server.send(204);
}

String kioskJsonStatus(bool online) {
  JsonDocument doc;
  doc["online"] = online;
  doc["lat"] = KIOSK_LAT;
  doc["lng"] = KIOSK_LNG;
  doc["name"] = KIOSK_NAME;
  doc["device"] = "esp32-s3";
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["rssi"] = isWiFiConnected() ? WiFi.RSSI() : 0;
  doc["camOnline"] = camLinkOnline();
  doc["dropLeft"] = dropSensorLeftCount();
  doc["dropRight"] = dropSensorRightCount();
  doc["irLeftBlocked"] = dropSensorLeftBlocked();
  doc["irRightBlocked"] = dropSensorRightBlocked();
  doc["phase"] = phaseName(kioskSessionPhase());
  doc["dispenseBusy"] = kioskSessionDispenseBusy();
  doc["pwmReady"] = dispenserPwmReady();
  doc["servoSafe"] = dispenserServoSafe();

  String out;
  serializeJson(doc, out);
  return out;
}

static void handleKioskPage() {
  server.send_P(200, "text/html; charset=utf-8", KIOSK_PAGE_HTML);
}

static void handleHealth() {
  sendCorsHeaders();
  server.send(200, "application/json", "{\"ok\":true,\"device\":\"esp32-s3\"}");
}

static void handleStatus() {
  sendCorsHeaders();
  server.send(200, "application/json", kioskJsonStatus(isWiFiConnected()));
}

static void handleKioskSession() {
  sendCorsHeaders();
  JsonDocument doc;
  doc["phase"] = phaseName(kioskSessionPhase());
  doc["countdownSec"] = kioskSessionCountdownSec();
  doc["camOnline"] = camLinkOnline();
  doc["dispenseBusy"] = kioskSessionDispenseBusy();
  doc["pwmReady"] = dispenserPwmReady();
  doc["servoSafe"] = dispenserServoSafe();

  const char* previewUrl = camLinkPreviewUrl();
  if (previewUrl && previewUrl[0] && kioskSessionPhase() == KIOSK_SCANNING) {
    doc["camPreviewUrl"] = previewUrl;
  }

  const char* err = kioskSessionError();
  if (err && err[0]) {
    doc["error"] = err;
  }

  const char* preview = kioskSessionPreviewJson();
  if (preview && preview[0]) {
    JsonDocument previewDoc;
    if (!deserializeJson(previewDoc, preview)) {
      doc["preview"] = previewDoc.as<JsonObject>();
    }
  }

  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

static void handleScanStart() {
  sendCorsHeaders();
  if (!camLinkPeerReady()) {
    server.send(503, "application/json", "{\"error\":\"cam peer not ready\"}");
    return;
  }
  if (!camLinkOnline()) {
    Serial.println("[kiosk] scan start — cam not pinged yet, trying SCAN anyway");
  }
  if (!kioskSessionStartScan()) {
    server.send(503, "application/json", "{\"error\":\"scan start failed\"}");
    return;
  }
  server.send(200, "application/json", "{\"ok\":true,\"phase\":\"scanning\"}");
}

static void handleScanCancel() {
  sendCorsHeaders();
  kioskSessionCancelScan();
  server.send(200, "application/json", "{\"ok\":true,\"phase\":\"idle\"}");
}

static void handlePickupConfirm() {
  sendCorsHeaders();
  if (dispenserIsBusy()) {
    server.send(409, "application/json", "{\"ok\":false,\"error\":\"dispense busy\"}");
    return;
  }
  const bool ok = kioskSessionConfirmPickup();
  if (ok) {
    server.send(200, "application/json", "{\"ok\":true,\"phase\":\"success\"}");
  } else {
    server.send(500, "application/json", "{\"ok\":false,\"error\":\"confirm failed\"}");
  }
}

static bool authorizeKioskRequest() {
  if (strlen(KIOSK_HEARTBEAT_SECRET) == 0) return false;
  const String provided = server.header("X-Kiosk-Secret");
  return provided == KIOSK_HEARTBEAT_SECRET;
}

static void handleDispense() {
  sendCorsHeaders();
  if (!authorizeKioskRequest()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\"}");
    return;
  }
  if (dispenserIsBusy()) {
    server.send(409, "application/json", "{\"error\":\"dispense busy\"}");
    return;
  }

  JsonDocument doc;
  const DeserializationError err = deserializeJson(doc, server.arg("plain"));
  if (err) {
    server.send(400, "application/json", "{\"error\":\"invalid json\"}");
    return;
  }

  const int slot = doc["slot"] | -1;
  if (slot < 0 || slot > 9) {
    server.send(400, "application/json", "{\"error\":\"invalid slot\"}");
    return;
  }

  Serial.printf("[web-cmd] LAN POST /dispense slot=%d\n", slot);
  const bool ok = dispenserDispenseSlot(static_cast<uint8_t>(slot));
  if (ok) {
    server.send(200, "application/json", "{\"ok\":true,\"slot\":" + String(slot) + "}");
  } else {
    server.send(500, "application/json", "{\"error\":\"dispense failed\"}");
  }
}

void kioskHttpSetup() {
  server.on("/kiosk", HTTP_GET, handleKioskPage);
  server.on("/kiosk/", HTTP_GET, handleKioskPage);
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/kiosk/session", HTTP_GET, handleKioskSession);
  server.on("/kiosk/scan/start", HTTP_POST, handleScanStart);
  server.on("/kiosk/scan/cancel", HTTP_POST, handleScanCancel);
  server.on("/kiosk/scan/cancel", HTTP_GET, handleScanCancel);
  server.on("/kiosk/pickup/confirm", HTTP_POST, handlePickupConfirm);
  server.on("/dispense", HTTP_POST, handleDispense);

  server.on("/kiosk/session", HTTP_OPTIONS, handleOptions);
  server.on("/kiosk/scan/start", HTTP_OPTIONS, handleOptions);
  server.on("/kiosk/scan/cancel", HTTP_OPTIONS, handleOptions);
  server.on("/kiosk/pickup/confirm", HTTP_OPTIONS, handleOptions);

  server.onNotFound([]() {
    sendCorsHeaders();
    server.send(404, "application/json", "{\"error\":\"not found\"}");
  });
  server.begin();
  Serial.println("[http] /kiosk /health /status /kiosk/* on port 80");
}

void kioskHttpLoop() {
  server.handleClient();
}
