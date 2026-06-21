#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

enum KioskPhase : uint8_t {
  KIOSK_IDLE = 0,
  KIOSK_SCANNING,
  KIOSK_PREVIEW,
  KIOSK_DISPENSING,
  KIOSK_SUCCESS,
  KIOSK_ERROR,
};

void kioskSessionReset();
bool kioskSessionStartScan();
void kioskSessionCancelScan();
void kioskSessionOnScanError(const char* msg);
bool kioskSessionOnQrCode(const char* code, const char* signature);
bool kioskSessionConfirmPickup();
void kioskSessionLoop();

KioskPhase kioskSessionPhase();
const char* kioskSessionPhaseName();
int kioskSessionCountdownSec();
const char* kioskSessionError();
const char* kioskSessionPreviewJson();
bool kioskSessionDispenseBusy();

void kioskSessionAppendCloudJson(JsonObject sessionOut);
bool kioskSessionCloudDirty();
void kioskSessionClearCloudDirty();
