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
static bool cloudDirty = false;

static void markCloudDirty() { cloudDirty = true; }

const char* kioskSessionPhaseName() {
  switch (phase) {
    case KIOSK_SCANNING: return "scanning";
    case KIOSK_PREVIEW: return "preview";
    case KIOSK_DISPENSING: return "dispensing";
    case KIOSK_SUCCESS: return "success";
    case KIOSK_ERROR: return "error";
    default: return "idle";
  }
}

void kioskSessionAppendCloudJson(JsonObject sessionOut) {
  sessionOut["phase"] = kioskSessionPhaseName();
  sessionOut["countdownSec"] = kioskSessionCountdownSec();
  sessionOut["camOnline"] = camLinkOnline();
  sessionOut["dispenseBusy"] = kioskSessionDispenseBusy();
  const char* err = kioskSessionError();
  if (err && err[0] && phase == KIOSK_ERROR) {
    sessionOut["error"] = err;
  }
  const char* preview = kioskSessionPreviewJson();
  if (preview && preview[0] && phase == KIOSK_PREVIEW) {
    JsonDocument previewDoc;
    if (!deserializeJson(previewDoc, preview)) {
      sessionOut["preview"] = previewDoc.as<JsonObject>();
    }
  }
}

bool kioskSessionCloudDirty() { return cloudDirty; }

void kioskSessionClearCloudDirty() { cloudDirty = false; }

void kioskSessionReset() {
  phase = KIOSK_IDLE;
  scanUntilMs = 0;
  sessionError[0] = '\0';
  previewJson[0] = '\0';
  pendingCode[0] = '\0';
  pendingSignature[0] = '\0';
  camLinkRequestScanStop();
  markCloudDirty();
}

bool kioskSessionStartScan() {
  if (phase == KIOSK_DISPENSING) return false;
  sessionError[0] = '\0';
  previewJson[0] = '\0';
  pendingCode[0] = '\0';
  pendingSignature[0] = '\0';
  if (!camLinkRequestScan()) return false;
  phase = KIOSK_SCANNING;
  scanUntilMs = millis() + 45000;
  Serial.println("[kiosk] scan started (45s)");
  markCloudDirty();
  return true;
}

void kioskSessionCancelScan() {
  kioskSessionReset();
  Serial.println("[kiosk] scan cancelled");
  markCloudDirty();
}

void kioskSessionOnScanError(const char* msg) {
  if (phase != KIOSK_SCANNING) return;
  phase = KIOSK_ERROR;
  scanUntilMs = 0;
  if (msg && msg[0] && strcmp(msg, "timeout") == 0) {
    strncpy(sessionError, "scan timeout", sizeof(sessionError) - 1);
  } else if (msg && msg[0]) {
    strncpy(sessionError, msg, sizeof(sessionError) - 1);
  } else {
    strncpy(sessionError, "scan timeout", sizeof(sessionError) - 1);
  }
  sessionError[sizeof(sessionError) - 1] = '\0';
  camLinkRequestScanStop();
  Serial.printf("[kiosk] scan error: %s\n", sessionError);
  markCloudDirty();
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
  String previewError;
  if (!pickupPreviewTicket(
          pendingCode,
          pendingSignature[0] ? pendingSignature : nullptr,
          previewBody,
          previewError)) {
    phase = KIOSK_ERROR;
    const char* err = previewError.length() ? previewError.c_str() : "preview failed";
    strncpy(sessionError, err, sizeof(sessionError) - 1);
    sessionError[sizeof(sessionError) - 1] = '\0';
    camLinkRequestScanStop();
    markCloudDirty();
    return false;
  }

  if (previewBody.length() >= sizeof(previewJson)) {
    phase = KIOSK_ERROR;
    strncpy(sessionError, "preview too large", sizeof(sessionError) - 1);
    sessionError[sizeof(sessionError) - 1] = '\0';
    markCloudDirty();
    return false;
  }

  strncpy(previewJson, previewBody.c_str(), sizeof(previewJson) - 1);
  previewJson[sizeof(previewJson) - 1] = '\0';
  phase = KIOSK_PREVIEW;
  scanUntilMs = 0;
  camLinkRequestScanStop();
  Serial.println("[kiosk] preview ready");
  markCloudDirty();
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
  markCloudDirty();
  const bool ok = pickupRedeemAndDispense(
      pendingCode,
      pendingSignature[0] ? pendingSignature : nullptr);

  if (ok) {
    phase = KIOSK_SUCCESS;
    previewJson[0] = '\0';
    pendingCode[0] = '\0';
    pendingSignature[0] = '\0';
    Serial.println("[kiosk] dispense success");
    markCloudDirty();
    return true;
  }

  phase = KIOSK_ERROR;
  strncpy(sessionError, "dispense failed", sizeof(sessionError) - 1);
  sessionError[sizeof(sessionError) - 1] = '\0';
  Serial.println("[kiosk] dispense failed");
  markCloudDirty();
  return false;
}

static unsigned long successAtMs = 0;
static unsigned long errorAtMs = 0;

void kioskSessionLoop() {
  if (phase == KIOSK_SCANNING && scanUntilMs > 0 && millis() > scanUntilMs) {
    kioskSessionOnScanError("timeout");
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

  if (phase == KIOSK_ERROR) {
    if (errorAtMs == 0) errorAtMs = millis();
    if (millis() - errorAtMs > 8000) {
      errorAtMs = 0;
      kioskSessionReset();
      Serial.println("[kiosk] error cleared → idle");
    }
  } else {
    errorAtMs = 0;
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
