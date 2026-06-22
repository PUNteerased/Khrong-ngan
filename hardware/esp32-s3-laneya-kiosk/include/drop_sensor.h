#pragma once

#include <Arduino.h>

void dropSensorSetup();
void dropSensorLoop();

bool dropSensorLeftBlocked();
bool dropSensorRightBlocked();
unsigned long dropSensorLeftCount();
unsigned long dropSensorRightCount();
