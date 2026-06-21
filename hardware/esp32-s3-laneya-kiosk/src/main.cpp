#include <Arduino.h>

#include "wifi_manager.h"
#include "kiosk_http.h"
#include "heartbeat.h"
#include "dispenser.h"
#include "drop_sensor.h"
#include "cam_link.h"
#include "kiosk_session.h"

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("[boot] LaneYa ESP32-S3 Kiosk");

  dropSensorSetup();
  connectWiFi();
  camLinkSetup();
  kioskHttpSetup();
  dispenserSetup();
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
