#pragma once

#include <Arduino.h>

void kioskHttpSetup();
void kioskHttpLoop();
String kioskJsonStatus(bool online);
