#include <Arduino.h>
#include <esp_system.h>

#include "wifi_manager.h"
#include "kiosk_http.h"
#include "heartbeat.h"
#include "dispenser.h"
#include "drop_sensor.h"
#include "cam_link.h"
#include "kiosk_session.h"

static const char* resetReasonText(esp_reset_reason_t reason) {
  switch (reason) {
    case ESP_RST_POWERON: return "power_on";
    case ESP_RST_EXT: return "external";
    case ESP_RST_SW: return "software";
    case ESP_RST_PANIC: return "panic";
    case ESP_RST_INT_WDT: return "int_wdt";
    case ESP_RST_TASK_WDT: return "task_wdt";
    case ESP_RST_WDT: return "wdt";
    case ESP_RST_DEEPSLEEP: return "deepsleep";
    case ESP_RST_BROWNOUT: return "brownout";
    case ESP_RST_SDIO: return "sdio";
    default: return "unknown";
  }
}

void setup() {
  dispenserPreBoot();
  dispenserSetup();

  Serial.begin(115200);
  delay(100);
  Serial.printf("[boot] reset reason: %s\n", resetReasonText(esp_reset_reason()));
  Serial.println("[boot] LaneYa ESP32-S3 Kiosk");

  dropSensorSetup();
  connectWiFi();
  camLinkSetup();
  kioskHttpSetup();
  heartbeatSetup();
}

void loop() {
  kioskHttpLoop();
  wifiLoop();
  heartbeatLoop();
  dropSensorLoop();
  camLinkLoop();
  kioskSessionLoop();
  dispenserLoop();
}
