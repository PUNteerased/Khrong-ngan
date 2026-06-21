#pragma once

#include <Arduino.h>

enum KioskPhase : uint8_t {
  KIOSK_IDLE = 0,
  KIOSK_SCANNING,
  KIOSK_PREVIEW,
  KIOSK_DISPENSING,
  KIOSK_SUCCESS,
  KIOSK_ERROR,
};

void kioskSessionReset();
void kioskSessionStartScan();
void kioskSessionCancelScan();
bool kioskSessionOnQrCode(const char* code, const char* signature);
bool kioskSessionConfirmPickup();
void kioskSessionLoop();

KioskPhase kioskSessionPhase();
int kioskSessionCountdownSec();
const char* kioskSessionError();
const char* kioskSessionPreviewJson();
bool kioskSessionDispenseBusy();
