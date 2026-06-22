#pragma once

#include <Arduino.h>

bool connectWiFi(unsigned long timeoutMs = 20000);
void wifiLoop();
bool isWiFiConnected();
