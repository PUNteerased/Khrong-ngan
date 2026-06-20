#pragma once

#include <Arduino.h>

// Phase 2 — PCA9685 + MG90S หมุนช่องยา
void dispenserSetup();
void dispenserLoop();
bool dispenserDispenseSlot(uint8_t slotIndex);
bool dispenserDispenseAll();
