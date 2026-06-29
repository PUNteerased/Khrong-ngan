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
#define CAMERA_FRAME_INTERVAL_MS 450
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
  if (code < 0) {
    Serial.printf("[cloud-sync] POST error %d (%s)\n", code, http.errorToString(code).c_str());
  } else if (!ok) {
    Serial.printf("[cloud-sync] HTTP %d (%s)\n", code, url);
  }
  http.end();
  return ok;
}

static unsigned long lastCamRelayWarnMs = 0;

static void camRelayWarnf(const char* fmt, int a) {
  const unsigned long now = millis();
  if (now - lastCamRelayWarnMs < 4000) return;
  lastCamRelayWarnMs = now;
  Serial.printf(fmt, a);
}

static void camRelayWarn(const char* msg) {
  const unsigned long now = millis();
  if (now - lastCamRelayWarnMs < 4000) return;
  lastCamRelayWarnMs = now;
  Serial.println(msg);
}

static bool postCameraFrameRaw(const uint8_t* data, size_t len) {
  if (!data || len < 100) return false;
  if (!isWiFiConnected()) return false;
  if (strlen(KIOSK_HEARTBEAT_SECRET) == 0) return false;
  if (strlen(BACKEND_CAMERA_FRAME_URL) == 0) return false;

  size_t b64Len = 0;
  const int sizeErr = mbedtls_base64_encode(nullptr, 0, &b64Len, data, len);
  if (sizeErr != MBEDTLS_ERR_BASE64_BUFFER_TOO_SMALL && sizeErr != 0) {
    camRelayWarn("[cam-relay] base64 size failed");
    return false;
  }

  std::vector<unsigned char> b64Buf(b64Len + 1, 0);
  size_t written = 0;
  if (mbedtls_base64_encode(b64Buf.data(), b64Buf.size(), &written, data, len) != 0) {
    camRelayWarn("[cam-relay] base64 encode failed");
    return false;
  }

  String body;
  body.reserve(written + 24);
  body = "{\"jpegBase64\":\"";
  body.concat(reinterpret_cast<const char*>(b64Buf.data()), written);
  body += "\"}";

  const bool ok = postCloudJson(BACKEND_CAMERA_FRAME_URL, body);
  if (!ok) {
    camRelayWarn("[cam-relay] JSON POST failed (see cloud-sync line above)");
  }
  return ok;
}

static size_t readCamJpegBody(HTTPClient& camHttp, WiFiClient* stream, uint8_t* buf, size_t capacity) {
  const int contentLen = camHttp.getSize();
  if (contentLen > 0 && static_cast<size_t>(contentLen) <= capacity) {
    return stream->readBytes(buf, static_cast<size_t>(contentLen));
  }

  size_t readTotal = 0;
  const unsigned long deadline = millis() + 4500;
  while (millis() < deadline && readTotal < capacity) {
    const int avail = stream->available();
    if (avail <= 0) {
      if (!camHttp.connected()) break;
      delay(1);
      continue;
    }
    const size_t chunk = static_cast<size_t>(avail);
    const size_t room = capacity - readTotal;
    readTotal += stream->readBytes(buf + readTotal, chunk < room ? chunk : room);
  }
  return readTotal;
}

static void relayCameraFrameIfScanning() {
  if (kioskSessionPhase() != KIOSK_SCANNING) return;
  if (millis() - lastCameraFrameMs < CAMERA_FRAME_INTERVAL_MS) return;

  const char* previewUrl = camLinkPreviewUrl();
  if (!previewUrl || !previewUrl[0]) {
    camRelayWarn("[cam-relay] no preview URL — รอ IP: จาก ESP32-CAM");
    return;
  }
  if (!isWiFiConnected()) return;
  if (strlen(BACKEND_CAMERA_FRAME_URL) == 0) return;
  if (strlen(KIOSK_HEARTBEAT_SECRET) == 0) return;

  lastCameraFrameMs = millis();

  WiFiClient camClient;
  HTTPClient camHttp;
  camHttp.setReuse(false);
  camHttp.begin(camClient, previewUrl);
  camHttp.setTimeout(8000);
  int camCode = -1;
  for (int attempt = 0; attempt < 3; attempt++) {
    camCode = camHttp.GET();
    if (camCode == HTTP_CODE_OK) break;
    if (camCode > 0) break;
    delay(150);
  }
  if (camCode != HTTP_CODE_OK) {
    if (camCode == 404 && kioskSessionPhase() == KIOSK_SCANNING) {
      camHttp.end();
      camLinkArmScanRemote();
      delay(350);
      camHttp.begin(camClient, previewUrl);
      camHttp.setTimeout(8000);
      camCode = camHttp.GET();
    }
    if (camCode != HTTP_CODE_OK) {
      if (camCode != 503 && camCode != 404) {
        camRelayWarnf("[cam-relay] CAM GET HTTP %d\n", camCode);
      }
      camHttp.end();
      return;
    }
  }

  WiFiClient* stream = camHttp.getStreamPtr();
  if (!stream) {
    camHttp.end();
    return;
  }

  const int contentLen = camHttp.getSize();
  size_t capacity = 16384;
  if (contentLen > 0 && contentLen <= 512000) {
    capacity = static_cast<size_t>(contentLen) + 128;
  }

  std::vector<uint8_t> jpeg(capacity);
  const size_t readTotal = readCamJpegBody(camHttp, stream, jpeg.data(), capacity);
  camHttp.end();

  if (readTotal < 100) {
    camRelayWarnf("[cam-relay] CAM read only %u bytes\n", static_cast<int>(readTotal));
    return;
  }

  if (postCameraFrameRaw(jpeg.data(), readTotal)) {
    Serial.printf("[cam-relay] posted %u bytes\n", static_cast<unsigned>(readTotal));
  }
}

void heartbeatPushSessionIfDirty() {
  if (!kioskSessionCloudDirty()) return;

  const String body = buildSessionSyncBody();
  if (postCloudJson(BACKEND_SESSION_SYNC_URL, body)) {
    kioskSessionClearCloudDirty();
    Serial.println("[cloud-sync] session pushed");
  }
}

static void handleDisplayCommand(const char* id, const char* action, const char* code) {
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
  } else if (strcmp(action, "submit_code") == 0) {
    Serial.printf("[web-cmd] received submit_code id=%s\n", id);
    if (!code || !code[0]) {
      ok = false;
      errMsg = "preview failed";
    } else {
      ok = kioskSessionOnManualCode(code);
      if (!ok) {
        const char* sessionErr = kioskSessionError();
        errMsg = sessionErr && sessionErr[0] ? sessionErr : "preview failed";
      }
    }
  } else if (strcmp(action, "confirm_pickup") == 0) {
    Serial.printf("[web-cmd] received confirm_pickup id=%s\n", id);
    ok = kioskSessionConfirmPickup();
    if (!ok) {
      const char* sessionErr = kioskSessionError();
      errMsg = sessionErr && sessionErr[0] ? sessionErr : "confirm failed";
    }
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
  const char* code = cmd["code"] | "";

  if (!id[0]) {
    Serial.println("[web-cmd] ignored invalid command");
    return;
  }

  if (strcmp(action, "scan_start") == 0 ||
      strcmp(action, "scan_cancel") == 0 ||
      strcmp(action, "submit_code") == 0 ||
      strcmp(action, "confirm_pickup") == 0) {
    if (dispenserIsBusy() && strcmp(action, "confirm_pickup") != 0 &&
        strcmp(action, "scan_cancel") != 0 && strcmp(action, "submit_code") != 0) {
      Serial.println("[web-cmd] rejected — dispense busy");
      queueAck(id, false, "busy");
      sendHeartbeat();
      lastHeartbeatMs = millis();
      return;
    }
    handleDisplayCommand(id, action, code);
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
