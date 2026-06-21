#include "kiosk_session.h"
#include "cam_link.h"
#include "pickup_redeem.h"
#include "dispenser.h"

#include <ArduinoJson.h>

static KioskPhase phase = KIOSK_IDLE;
static unsigned long scanUntilMs = 0;
static char sessionError[96] = {};
static char previewJson[2048] = {};
static char pendingCode[32] = {};
static char pendingSignature[128] = {};

void kioskSessionReset() {
  phase = KIOSK_IDLE;
  scanUntilMs = 0;
  sessionError[0] = '\0';
  previewJson[0] = '\0';
  pendingCode[0] = '\0';
  pendingSignature[0] = '\0';
  camLinkRequestScanStop();
}

void kioskSessionStartScan() {
  if (phase == KIOSK_DISPENSING) return;
  sessionError[0] = '\0';
  previewJson[0] = '\0';
  pendingCode[0] = '\0';
  pendingSignature[0] = '\0';
  phase = KIOSK_SCANNING;
  scanUntilMs = millis() + 45000;
  camLinkRequestScan();
  Serial.println("[kiosk] scan started (45s)");
}

void kioskSessionCancelScan() {
  kioskSessionReset();
  Serial.println("[kiosk] scan cancelled");
}

bool kioskSessionOnQrCode(const char* code, const char* signature) {
  if (!code || !code[0]) return false;
  if (phase != KIOSK_SCANNING && phase != KIOSK_PREVIEW) {
    return false;
  }

  strncpy(pendingCode, code, sizeof(pendingCode) - 1);
  pendingCode[sizeof(pendingCode) - 1] = '\0';
  if (signature && signature[0]) {
    strncpy(pendingSignature, signature, sizeof(pendingSignature) - 1);
    pendingSignature[sizeof(pendingSignature) - 1] = '\0';
  } else {
    pendingSignature[0] = '\0';
  }

  String previewBody;
  if (!pickupPreviewTicket(pendingCode, pendingSignature[0] ? pendingSignature : nullptr, previewBody)) {
    phase = KIOSK_ERROR;
    strncpy(sessionError, "preview failed", sizeof(sessionError) - 1);
    camLinkRequestScanStop();
    return false;
  }

  if (previewBody.length() >= sizeof(previewJson)) {
    phase = KIOSK_ERROR;
    strncpy(sessionError, "preview too large", sizeof(sessionError) - 1);
    return false;
  }

  strncpy(previewJson, previewBody.c_str(), sizeof(previewJson) - 1);
  previewJson[sizeof(previewJson) - 1] = '\0';
  phase = KIOSK_PREVIEW;
  scanUntilMs = 0;
  camLinkRequestScanStop();
  Serial.println("[kiosk] preview ready");
  return true;
}

bool kioskSessionConfirmPickup() {
  if (phase != KIOSK_PREVIEW || !pendingCode[0]) {
    return false;
  }
  if (dispenserIsBusy()) {
    Serial.println("[kiosk] confirm rejected — dispense busy");
    return false;
  }

  phase = KIOSK_DISPENSING;
  const bool ok = pickupRedeemAndDispense(
      pendingCode,
      pendingSignature[0] ? pendingSignature : nullptr);

  if (ok) {
    phase = KIOSK_SUCCESS;
    previewJson[0] = '\0';
    pendingCode[0] = '\0';
    pendingSignature[0] = '\0';
    Serial.println("[kiosk] dispense success");
    return true;
  }

  phase = KIOSK_ERROR;
  strncpy(sessionError, "dispense failed", sizeof(sessionError) - 1);
  Serial.println("[kiosk] dispense failed");
  return false;
}

static unsigned long successAtMs = 0;

void kioskSessionLoop() {
  if (phase == KIOSK_SCANNING && scanUntilMs > 0 && millis() > scanUntilMs) {
    phase = KIOSK_IDLE;
    scanUntilMs = 0;
    camLinkRequestScanStop();
    Serial.println("[kiosk] scan timeout");
  }

  if (phase == KIOSK_SUCCESS) {
    if (successAtMs == 0) successAtMs = millis();
    if (millis() - successAtMs > 3000) {
      successAtMs = 0;
      kioskSessionReset();
    }
  } else {
    successAtMs = 0;
  }
}

KioskPhase kioskSessionPhase() { return phase; }

int kioskSessionCountdownSec() {
  if (phase != KIOSK_SCANNING || scanUntilMs == 0) return 0;
  const long ms = static_cast<long>(scanUntilMs - millis());
  if (ms <= 0) return 0;
  return static_cast<int>((ms + 999) / 1000);
}

const char* kioskSessionError() { return sessionError; }

const char* kioskSessionPreviewJson() { return previewJson; }

bool kioskSessionDispenseBusy() { return dispenserIsBusy(); }
