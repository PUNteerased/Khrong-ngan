/*
 * LaneYa — ESP32-S3 Connext (เทสเชื่อมต่ออย่างเดียว)
 * WiFi + HTTP local + heartbeat HTTPS ไป backend
 *
 * Arduino IDE → Tools:
 *   Board: ESP32S3 Dev Module
 *   USB CDC On Boot: Enabled
 *   Flash Size: 16MB (128Mb)
 *   PSRAM: OPI PSRAM
 */

// ============ CONFIG — แก้ก่อน upload ============
#define WIFI_SSID "hah"
#define WIFI_PASSWORD "Araina555"

#define KIOSK_LAT 17.0075
#define KIOSK_LNG 99.8260
#define KIOSK_NAME "LaneYa Kiosk"

#define BACKEND_HEARTBEAT_URL "https://khrong-ngan.onrender.com/api/kiosk/heartbeat"
#define KIOSK_HEARTBEAT_SECRET "change-me-kiosk-secret"

#define FIRMWARE_VERSION "1.0.0-connext"
#define HEARTBEAT_INTERVAL_MS 60000
// ================================================

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

WebServer server(80);
unsigned long lastHeartbeatMs = 0;
unsigned long lastWifiRetryMs = 0;

const char* wifiStatusText(wl_status_t s) {
  switch (s) {
    case WL_IDLE_STATUS: return "idle";
    case WL_NO_SSID_AVAIL: return "no SSID found";
    case WL_SCAN_COMPLETED: return "scan done";
    case WL_CONNECTED: return "connected";
    case WL_CONNECT_FAILED: return "wrong password";
    case WL_CONNECTION_LOST: return "connection lost";
    case WL_DISCONNECTED: return "disconnected";
    default: return "unknown";
  }
}

bool connectWiFi(unsigned long timeoutMs = 20000) {
  if (WiFi.status() == WL_CONNECTED) return true;

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.disconnect(true, true);
  delay(200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[wifi] connecting to \"%s\"...\n", WIFI_SSID);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < timeoutMs) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] OK — IP %s  RSSI %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
    return true;
  }

  Serial.printf("[wifi] FAILED — status %d (%s)\n",
                WiFi.status(), wifiStatusText(WiFi.status()));
  Serial.println("[wifi] ใช้ WiFi 2.4GHz — ฮอตสปอตเปิด Maximize Compatibility");
  return false;
}

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

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, BACKEND_HEARTBEAT_URL);
  http.setTimeout(45000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Kiosk-Secret", KIOSK_HEARTBEAT_SECRET);

  const int code = http.POST(jsonStatus(true));
  if (code > 0) {
    Serial.printf("[heartbeat] HTTP %d\n", code);
  } else {
    Serial.printf("[heartbeat] error %d (%s)\n", code, http.errorToString(code).c_str());
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("[boot] LaneYa ESP32-S3 Connext");

  connectWiFi();

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

  if (WiFi.status() != WL_CONNECTED &&
      millis() - lastWifiRetryMs >= 15000) {
    connectWiFi(15000);
    lastWifiRetryMs = millis();
  }

  if (millis() - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
    sendHeartbeat();
    lastHeartbeatMs = millis();
  }
}
