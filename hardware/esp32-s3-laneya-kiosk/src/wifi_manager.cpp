#include "wifi_manager.h"

#include <WiFi.h>

#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#endif

static unsigned long lastWifiRetryMs = 0;

static const char* wifiStatusText(wl_status_t s) {
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

bool isWiFiConnected() {
  return WiFi.status() == WL_CONNECTED;
}

bool connectWiFi(unsigned long timeoutMs) {
  if (isWiFiConnected()) return true;

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.disconnect(true, true);
  delay(200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[wifi] connecting to \"%s\"...\n", WIFI_SSID);

  const unsigned long start = millis();
  while (!isWiFiConnected() && millis() - start < timeoutMs) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (isWiFiConnected()) {
    Serial.printf("[wifi] OK — IP %s  RSSI %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
    return true;
  }

  Serial.printf("[wifi] FAILED — status %d (%s)\n",
                WiFi.status(), wifiStatusText(WiFi.status()));
  return false;
}

void wifiLoop() {
  if (isWiFiConnected()) return;
  if (millis() - lastWifiRetryMs < 15000) return;
  connectWiFi(15000);
  lastWifiRetryMs = millis();
}
