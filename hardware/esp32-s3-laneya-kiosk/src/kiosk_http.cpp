#include "kiosk_http.h"
#include "wifi_manager.h"
#include "drop_sensor.h"
#include "cam_link.h"
#include "dispenser.h"

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#endif

static WebServer server(80);

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

  String out;
  serializeJson(doc, out);
  return out;
}

static void handleHealth() {
  server.send(200, "application/json", "{\"ok\":true,\"device\":\"esp32-s3\"}");
}

static void handleStatus() {
  server.send(200, "application/json", kioskJsonStatus(isWiFiConnected()));
}

static bool authorizeKioskRequest() {
  if (strlen(KIOSK_HEARTBEAT_SECRET) == 0) return false;
  const String provided = server.header("X-Kiosk-Secret");
  return provided == KIOSK_HEARTBEAT_SECRET;
}

static void handleDispense() {
  if (!authorizeKioskRequest()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\"}");
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
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/dispense", HTTP_POST, handleDispense);
  server.onNotFound([]() {
    server.send(404, "application/json", "{\"error\":\"not found\"}");
  });
  server.begin();
  Serial.println("[http] /health /status /dispense on port 80");
}

void kioskHttpLoop() {
  server.handleClient();
}
