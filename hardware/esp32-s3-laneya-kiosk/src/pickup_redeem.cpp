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

#ifndef BACKEND_PREVIEW_URL
#define BACKEND_PREVIEW_URL "https://khrong-ngan.onrender.com/api/kiosk/preview-ticket"
#endif

static void mapHttpError(int status, String& errorOut) {
  switch (status) {
    case 401:
      errorOut = "unauthorized";
      break;
    case 404:
      errorOut = "ticket not found";
      break;
    case 410:
      errorOut = "ticket expired";
      break;
    default:
      errorOut = "preview failed";
      break;
  }
}

static bool postKioskTicket(
    const char* url,
    const char* code,
    const char* signature,
    String& response,
    String& errorOut) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[pickup] WiFi not connected");
    errorOut = "preview failed";
    return false;
  }
  if (!code || !code[0]) {
    Serial.println("[pickup] missing code");
    errorOut = "preview failed";
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, url);
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
  response = http.getString();
  if (status < 200 || status >= 300) {
    Serial.printf("[pickup] HTTP %d (%s) body=%s\n", status, url, response.c_str());
    http.end();
    mapHttpError(status, errorOut);
    return false;
  }

  http.end();
  return true;
}

bool pickupPreviewTicket(
    const char* code,
    const char* signature,
    String& outJson,
    String& errorOut) {
  errorOut = "";
  String response;
  if (!postKioskTicket(BACKEND_PREVIEW_URL, code, signature, response, errorOut)) {
    if (errorOut.length() == 0) errorOut = "preview failed";
    return false;
  }

  JsonDocument res;
  if (deserializeJson(res, response)) {
    Serial.println("[pickup] invalid preview JSON");
    errorOut = "preview failed";
    return false;
  }
  if (!res["ok"].as<bool>()) {
    const char* err = res["error"] | "preview failed";
    errorOut = err;
    Serial.printf("[pickup] preview not ok: %s\n", err);
    return false;
  }

  outJson = response;
  Serial.println("[pickup] preview ok");
  return true;
}

bool pickupRedeemAndDispense(
    const char* code,
    const char* signature,
    String* errorOut) {
  String response;
  String error;
  if (!postKioskTicket(BACKEND_REDEEM_URL, code, signature, response, error)) {
    if (errorOut) {
      *errorOut = error.length() ? error : String("dispense failed");
    }
    return false;
  }

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
