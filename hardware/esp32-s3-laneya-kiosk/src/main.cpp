#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#warning "Using config.example.h — copy to config.h and set WiFi + secrets"
#endif

WebServer server(80);
unsigned long lastHeartbeatMs = 0;

String jsonStatus(bool online) {
  JsonDocument doc;
  doc["online"] = online;
  doc["lat"] = KIOSK_LAT;
  doc["lng"] = KIOSK_LNG;
  doc["name"] = KIOSK_NAME;
  doc["device"] = "esp32-s3";
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["rssi"] = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0;

  String out;
  serializeJson(doc, out);
  return out;
}

void handleHealth() {
  server.send(200, "application/json", "{\"ok\":true,\"device\":\"esp32-s3\"}");
}

void handleStatus() {
  const bool online = WiFi.status() == WL_CONNECTED;
  server.send(200, "application/json", jsonStatus(online));
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (strlen(KIOSK_HEARTBEAT_SECRET) == 0) return;
  if (strlen(BACKEND_HEARTBEAT_URL) == 0) return;

  HTTPClient http;
  http.begin(BACKEND_HEARTBEAT_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Kiosk-Secret", KIOSK_HEARTBEAT_SECRET);

  String body = jsonStatus(true);
  const int code = http.POST(body);
  Serial.printf("[heartbeat] POST %s -> %d\n", BACKEND_HEARTBEAT_URL, code);
  http.end();
}

void setupRoutes() {
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/status", HTTP_GET, handleStatus);
  server.onNotFound([]() {
    server.send(404, "application/json", "{\"error\":\"not found\"}");
  });
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("[boot] LaneYa ESP32-S3 kiosk");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[wifi] connecting to %s\n", WIFI_SSID);

  const unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 30000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] connected IP=%s RSSI=%d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println("[wifi] failed — HTTP server still starts for local debug");
  }

  setupRoutes();
  server.begin();
  Serial.println("[http] /health /status ready on port 80");

  sendHeartbeat();
  lastHeartbeatMs = millis();
}

void loop() {
  server.handleClient();

  const unsigned long now = millis();
  if (now - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
    sendHeartbeat();
    lastHeartbeatMs = now;
  }
}
