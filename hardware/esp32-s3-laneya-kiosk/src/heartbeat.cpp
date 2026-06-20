#include "heartbeat.h"
#include "kiosk_http.h"
#include "wifi_manager.h"
#include "dispenser.h"

#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFi.h>
#include <ArduinoJson.h>

#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#endif

static unsigned long lastHeartbeatMs = 0;

static struct {
  bool pending = false;
  char id[40] = {};
  bool ok = true;
  char error[64] = {};
} pendingAck;

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

static String buildHeartbeatBody() {
  JsonDocument doc;
  doc["online"] = true;
  doc["lat"] = KIOSK_LAT;
  doc["lng"] = KIOSK_LNG;
  doc["name"] = KIOSK_NAME;
  doc["device"] = "esp32-s3";
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["rssi"] = isWiFiConnected() ? WiFi.RSSI() : 0;

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

  if (!id[0] || strcmp(action, "dispense") != 0 || slot < 0 || slot > 9) {
    Serial.println("[web-cmd] ignored invalid command");
    return;
  }

  Serial.printf("[web-cmd] received dispense slot=%d id=%s\n", slot, id);
  const bool ok = dispenserDispenseSlot(static_cast<uint8_t>(slot));
  queueAck(id, ok, ok ? nullptr : "dispense failed");
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
  if (millis() - lastHeartbeatMs < HEARTBEAT_INTERVAL_MS) return;
  sendHeartbeat();
  lastHeartbeatMs = millis();
}
