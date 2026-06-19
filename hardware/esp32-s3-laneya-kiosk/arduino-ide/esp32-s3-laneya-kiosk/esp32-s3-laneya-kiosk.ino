/*
 * LaneYa — ESP32-S3 N16R8 (16MB Flash / 8MB PSRAM)
 * Phase 1: เทส WiFi + HTTP + heartbeat ไปเว็บ (ยังไม่ใช้ PCA9685 / กล้อง)
 *
 * Arduino IDE → Tools:
 *   Board: ESP32S3 Dev Module
 *   USB CDC On Boot: Enabled
 *   Flash Size: 16MB (128Mb)
 *   PSRAM: OPI PSRAM
 *   Upload Speed: 921600 (หรือ 115200 ถ้าอัปโหลดไม่ผ่าน)
 */

// ============ CONFIG — แก้ก่อน upload ============
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

#define KIOSK_LAT 17.0075
#define KIOSK_LNG 99.8260
#define KIOSK_NAME "LaneYa Kiosk"

#define BACKEND_HEARTBEAT_URL "https://khrong-ngan.onrender.com/api/kiosk/heartbeat"
#define KIOSK_HEARTBEAT_SECRET "change-me-kiosk-secret"

#define FIRMWARE_VERSION "1.0.0"
#define HEARTBEAT_INTERVAL_MS 60000
// ================================================

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>

WebServer server(80);
unsigned long lastHeartbeatMs = 0;

String jsonStatus(bool online) {
  String s = "{";
  s += "\"online\":" + String(online ? "true" : "false") + ",";
  s += "\"lat\":" + String(KIOSK_LAT, 6) + ",";
  s += "\"lng\":" + String(KIOSK_LNG, 6) + ",";
  s += "\"name\":\"" + String(KIOSK_NAME) + "\",";
  s += "\"device\":\"esp32-s3\",";
  s += "\"firmwareVersion\":\"" + String(FIRMWARE_VERSION) + "\",";
  s += "\"rssi\":" + String(WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0);
  s += "}";
  return s;
}

void handleHealth() {
  server.send(200, "application/json", "{\"ok\":true,\"device\":\"esp32-s3\"}");
}

void handleStatus() {
  server.send(200, "application/json", jsonStatus(WiFi.status() == WL_CONNECTED));
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (strlen(KIOSK_HEARTBEAT_SECRET) == 0) return;

  HTTPClient http;
  http.begin(BACKEND_HEARTBEAT_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Kiosk-Secret", KIOSK_HEARTBEAT_SECRET);
  int code = http.POST(jsonStatus(true));
  Serial.printf("[heartbeat] %d\n", code);
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("[boot] LaneYa ESP32-S3 (Arduino IDE)");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[wifi] %s\n", WIFI_SSID);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 30000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(WiFi.localIP());
  }

  server.on("/health", HTTP_GET, handleHealth);
  server.on("/status", HTTP_GET, handleStatus);
  server.onNotFound([]() {
    server.send(404, "application/json", "{\"error\":\"not found\"}");
  });
  server.begin();

  sendHeartbeat();
  lastHeartbeatMs = millis();
}

void loop() {
  server.handleClient();
  if (millis() - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
    sendHeartbeat();
    lastHeartbeatMs = millis();
  }
}
