#include "heartbeat.h"
#include "kiosk_http.h"
#include "wifi_manager.h"
#include "dispenser.h"
#include "kiosk_session.h"
#include "cam_link.h"

#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiClient.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <vector>
#include "mbedtls/base64.h"

#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#endif

#ifndef BACKEND_SESSION_SYNC_URL
#define BACKEND_SESSION_SYNC_URL "https://khrong-ngan.onrender.com/api/kiosk/session-sync"
#endif

#ifndef HEARTBEAT_ACTIVE_INTERVAL_MS
#define HEARTBEAT_ACTIVE_INTERVAL_MS 2500
#endif

#ifndef BACKEND_CAMERA_FRAME_URL
#define BACKEND_CAMERA_FRAME_URL "https://khrong-ngan.onrender.com/api/kiosk/camera-frame"
#endif

#ifndef CAMERA_FRAME_INTERVAL_MS
#define CAMERA_FRAME_INTERVAL_MS 500
#endif

static unsigned long lastHeartbeatMs = 0;
static unsigned long lastCameraFrameMs = 0;

static struct {
  bool pending = false;
  char id[40] = {};
  bool ok = true;
  char error[64] = {};
} pendingAck;

#ifndef ALLOW_DISPENSE_ALL
#define ALLOW_DISPENSE_ALL 0
#endif

static void queueAck(const char* id, bool ok, const char* errMsg = nullptr) {
  pendingAck.pending = true;
  strncpy(pendingAck.id, id, sizeof(pendingAck.id) - 1);
  pendingAck.ok = ok;
  if (errMsg && errMsg[0]) {
    strncpy(pendingAck.error, errMsg, sizeof(pendingAck.error) - 1);
  } else {
    pendingAck.error[0] = '\0';
  }
  Serial.printf("[web-cmd] done %s — ack queued id=%s\n", ok ? "ok" : "fail", id);
}

static String buildSessionSyncBody() {
  JsonDocument doc;
  JsonObject session = doc["session"].to<JsonObject>();
  kioskSessionAppendCloudJson(session);
  String out;
  serializeJson(doc, out);
  return out;
}

static String buildHeartbeatBody() {
  JsonDocument doc;
  doc["online"] = true;
  doc["lat"] = KIOSK_LAT;
  doc["lng"] = KIOSK_LNG;
  doc["name"] = KIOSK_NAME;
  doc["device"] = "esp32-s3";
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["rssi"] = isWiFiConnected() ? WiFi.RSSI() : 0;

  JsonObject session = doc["session"].to<JsonObject>();
  kioskSessionAppendCloudJson(session);

  if (pendingAck.pending) {
    JsonObject ack = doc["commandAck"].to<JsonObject>();
    ack["id"] = pendingAck.id;
    ack["ok"] = pendingAck.ok;
    if (pendingAck.error[0]) {
      ack["error"] = pendingAck.error;
    }
    Serial.printf("[web-cmd] ack sent id=%s ok=%s\n",
                  pendingAck.id, pendingAck.ok ? "true" : "false");
    pendingAck.pending = false;
  }

  String out;
  serializeJson(doc, out);
  return out;
}

static void sendHeartbeat();
static void handleCommandFromResponse(const String& response);

static bool postCloudJson(const char* url, const String& body) {
  if (!isWiFiConnected()) return false;
  if (strlen(KIOSK_HEARTBEAT_SECRET) == 0) return false;
  if (!url || !url[0]) return false;

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, url);
  http.setTimeout(20000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Kiosk-Secret", KIOSK_HEARTBEAT_SECRET);

  const int code = http.POST(body);
  const bool ok = code >= 200 && code < 300;
  if (!ok && code > 0) {
    Serial.printf("[cloud-sync] HTTP %d (%s)\n", code, url);
  }
  http.end();
  return ok;
}

static bool encodeJpegBase64(const uint8_t* data, size_t len, String& out) {
  if (!data || len == 0) return false;
  size_t olen = 0;
  if (mbedtls_base64_encode(nullptr, 0, &olen, data, len) != MBEDTLS_ERR_BASE64_BUFFER_TOO_SMALL) {
    return false;
  }
  out.reserve(olen + 1);
  std::vector<unsigned char> buf(olen + 1);
  if (mbedtls_base64_encode(buf.data(), buf.size(), &olen, data, len) != 0) {
    return false;
  }
  out = String(reinterpret_cast<const char*>(buf.data()), olen);
  return true;
}

static void relayCameraFrameIfScanning() {
  if (kioskSessionPhase() != KIOSK_SCANNING) return;
  if (millis() - lastCameraFrameMs < CAMERA_FRAME_INTERVAL_MS) return;

  const char* previewUrl = camLinkPreviewUrl();
  if (!previewUrl || !previewUrl[0]) return;
  if (!isWiFiConnected()) return;
  if (strlen(BACKEND_CAMERA_FRAME_URL) == 0) return;
  if (strlen(KIOSK_HEARTBEAT_SECRET) == 0) return;

  lastCameraFrameMs = millis();

  WiFiClient camClient;
  HTTPClient camHttp;
  camHttp.begin(camClient, previewUrl);
  camHttp.setTimeout(4000);
  const int camCode = camHttp.GET();
  if (camCode != HTTP_CODE_OK) {
    camHttp.end();
    return;
  }

  const int len = camHttp.getSize();
  if (len <= 0 || len > 512000) {
    camHttp.end();
    return;
  }

  WiFiClient* stream = camHttp.getStreamPtr();
  if (!stream) {
    camHttp.end();
    return;
  }

  std::vector<uint8_t> jpeg(static_cast<size_t>(len));
  size_t readTotal = 0;
  while (readTotal < static_cast<size_t>(len) && camHttp.connected()) {
    const size_t n = stream->readBytes(
        jpeg.data() + readTotal, static_cast<size_t>(len) - readTotal);
    if (n == 0) break;
    readTotal += n;
  }
  camHttp.end();

  if (readTotal < 100) return;

  String b64;
  if (!encodeJpegBase64(jpeg.data(), readTotal, b64)) return;

  JsonDocument doc;
  doc["jpegBase64"] = b64;
  String body;
  serializeJson(doc, body);
  postCloudJson(BACKEND_CAMERA_FRAME_URL, body);
}

void heartbeatPushSessionIfDirty() {
  if (!kioskSessionCloudDirty()) return;

  const String body = buildSessionSyncBody();
  if (postCloudJson(BACKEND_SESSION_SYNC_URL, body)) {
    kioskSessionClearCloudDirty();
    Serial.println("[cloud-sync] session pushed");
  }
}

static void handleDisplayCommand(const char* id, const char* action) {
  bool ok = false;
  const char* errMsg = nullptr;

  if (strcmp(action, "scan_start") == 0) {
    Serial.printf("[web-cmd] received scan_start id=%s\n", id);
    ok = kioskSessionStartScan();
    if (!ok) errMsg = "scan start failed";
  } else if (strcmp(action, "scan_cancel") == 0) {
    Serial.printf("[web-cmd] received scan_cancel id=%s\n", id);
    kioskSessionCancelScan();
    ok = true;
  } else if (strcmp(action, "confirm_pickup") == 0) {
    Serial.printf("[web-cmd] received confirm_pickup id=%s\n", id);
    ok = kioskSessionConfirmPickup();
    if (!ok) errMsg = "confirm failed";
  } else {
    Serial.println("[web-cmd] ignored invalid command");
    return;
  }

  queueAck(id, ok, ok ? nullptr : errMsg);
  heartbeatPushSessionIfDirty();
  sendHeartbeat();
  lastHeartbeatMs = millis();
}

static void handleCommandFromResponse(const String& response) {
  JsonDocument doc;
  if (deserializeJson(doc, response)) {
    Serial.println("[heartbeat] invalid JSON response");
    return;
  }

  JsonObject cmd = doc["command"];
  if (cmd.isNull()) return;

  const char* id = cmd["id"] | "";
  const char* action = cmd["action"] | "";
  const int slot = cmd["slot"] | -1;

  if (!id[0]) {
    Serial.println("[web-cmd] ignored invalid command");
    return;
  }

  if (strcmp(action, "scan_start") == 0 ||
      strcmp(action, "scan_cancel") == 0 ||
      strcmp(action, "confirm_pickup") == 0) {
    if (dispenserIsBusy() && strcmp(action, "confirm_pickup") != 0 &&
        strcmp(action, "scan_cancel") != 0) {
      Serial.println("[web-cmd] rejected — dispense busy");
      queueAck(id, false, "busy");
      sendHeartbeat();
      lastHeartbeatMs = millis();
      return;
    }
    handleDisplayCommand(id, action);
    return;
  }

  if (dispenserIsBusy()) {
    Serial.println("[web-cmd] rejected — dispense busy");
    queueAck(id, false, "busy");
    sendHeartbeat();
    lastHeartbeatMs = millis();
    return;
  }

  bool ok = false;
  if (strcmp(action, "dispense_all") == 0) {
#if !ALLOW_DISPENSE_ALL
    Serial.println("[web-cmd] rejected dispense_all (disabled in production)");
    queueAck(id, false, "dispense_all disabled");
    sendHeartbeat();
    lastHeartbeatMs = millis();
    return;
#else
    Serial.printf("[web-cmd] received dispense_all id=%s\n", id);
    ok = dispenserDispenseAll();
#endif
  } else if (strcmp(action, "dispense") == 0 && slot >= 0 && slot <= 9) {
    Serial.printf("[web-cmd] received dispense slot=%d id=%s\n", slot, id);
    ok = dispenserDispenseSlot(static_cast<uint8_t>(slot));
  } else {
    Serial.println("[web-cmd] ignored invalid command");
    return;
  }

  queueAck(id, ok, ok ? nullptr : "dispense failed");
  sendHeartbeat();
  lastHeartbeatMs = millis();
}

static void sendHeartbeat() {
  if (!isWiFiConnected()) return;
  if (strlen(KIOSK_HEARTBEAT_SECRET) == 0) return;
  if (strlen(BACKEND_HEARTBEAT_URL) == 0) return;

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, BACKEND_HEARTBEAT_URL);
  http.setTimeout(45000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Kiosk-Secret", KIOSK_HEARTBEAT_SECRET);

  const String body = buildHeartbeatBody();
  const int code = http.POST(body);

  if (code >= 200 && code < 300) {
    const String response = http.getString();
    Serial.printf("[heartbeat] HTTP %d\n", code);
    handleCommandFromResponse(response);
  } else if (code > 0) {
    Serial.printf("[heartbeat] HTTP %d\n", code);
  } else {
    Serial.printf("[heartbeat] error %d (%s)\n", code, http.errorToString(code).c_str());
  }
  http.end();
}

void heartbeatSetup() {
  sendHeartbeat();
  lastHeartbeatMs = millis();
}

void heartbeatLoop() {
  heartbeatPushSessionIfDirty();
  relayCameraFrameIfScanning();

  unsigned long interval = HEARTBEAT_INTERVAL_MS;
  if (kioskSessionPhase() != KIOSK_IDLE) {
    interval = HEARTBEAT_ACTIVE_INTERVAL_MS;
  }

  if (millis() - lastHeartbeatMs < interval) return;
  sendHeartbeat();
  lastHeartbeatMs = millis();
}
