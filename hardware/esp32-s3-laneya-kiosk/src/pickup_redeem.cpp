#include "pickup_redeem.h"

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

#ifndef BACKEND_REDEEM_URL
#define BACKEND_REDEEM_URL "https://khrong-ngan.onrender.com/api/kiosk/redeem-ticket"
#endif

bool pickupRedeemAndDispense(const char* code, const char* signature) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[pickup] WiFi not connected");
    return false;
  }
  if (!code || !code[0]) {
    Serial.println("[pickup] missing code");
    return false;
  }
  (void)signature;

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, BACKEND_REDEEM_URL);
  http.setTimeout(30000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Kiosk-Secret", KIOSK_HEARTBEAT_SECRET);

  JsonDocument doc;
  doc["code"] = code;
  if (signature && signature[0]) {
    doc["signature"] = signature;
  }
  String body;
  serializeJson(doc, body);

  const int status = http.POST(body);
  if (status < 200 || status >= 300) {
    Serial.printf("[pickup] redeem HTTP %d\n", status);
    http.end();
    return false;
  }

  const String response = http.getString();
  http.end();

  JsonDocument res;
  if (deserializeJson(res, response)) {
    Serial.println("[pickup] invalid redeem JSON");
    return false;
  }

  if (!res["ok"].as<bool>()) {
    Serial.println("[pickup] redeem not ok");
    return false;
  }

  const int channel = res["channel"] | -1;
  const char* slotId = res["slotId"] | "?";
  if (channel < 0 || channel > 9) {
    Serial.println("[pickup] invalid channel");
    return false;
  }

  Serial.printf("[pickup] redeem ok slot=%s ch=%d — dispense\n", slotId, channel);
  const bool ok = dispenserDispenseSlot(static_cast<uint8_t>(channel));
  Serial.printf("[pickup] dispense %s\n", ok ? "ok" : "fail");
  return ok;
}
