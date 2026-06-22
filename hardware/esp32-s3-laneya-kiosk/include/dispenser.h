#pragma once

#include <Arduino.h>

// PCA9685 + MG90S 360° — ช่องจ่ายยา 0–9
void dispenserPreBoot();
void dispenserSetup();
void dispenserLoop();
bool dispenserIsBusy();
bool dispenserPwmReady();
bool dispenserServoSafe();
bool dispenserDispenseSlot(uint8_t slotIndex);
bool dispenserDispenseAll();
