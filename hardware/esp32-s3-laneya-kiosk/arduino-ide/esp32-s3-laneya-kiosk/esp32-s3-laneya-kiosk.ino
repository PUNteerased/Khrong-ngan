/*
 * LaneYa — ESP32-S3 Kiosk (Arduino IDE)
 *
 * Libraries (Arduino IDE → Library Manager):
 *   - ArduinoJson
 *   - Adafruit PWM Servo Driver Library
 *   - Adafruit BusIO
 *
 * Tools → Board: ESP32S3 Dev Module, Flash 16MB, PSRAM OPI, USB CDC On Boot Enabled
 * Serial Monitor: 115200 — ดู [web-cmd] เมื่อ Admin ส่งคำสั่งจากเว็บ
 */

// ============ CONFIG — แก้ก่อน upload ============
#define WIFI_SSID "SAENEE UNTA 2.4G"
#define WIFI_PASSWORD "0819534686"

#define KIOSK_LAT 17.0147929
#define KIOSK_LNG 99.820863
#define KIOSK_NAME "LaneYa Kiosk"

#define BACKEND_HEARTBEAT_URL "https://khrong-ngan.onrender.com/api/kiosk/heartbeat"
#define BACKEND_SESSION_SYNC_URL "https://khrong-ngan.onrender.com/api/kiosk/session-sync"
#define BACKEND_REDEEM_URL "https://khrong-ngan.onrender.com/api/kiosk/redeem-ticket"
#define BACKEND_PREVIEW_URL "https://khrong-ngan.onrender.com/api/kiosk/preview-ticket"
#define BACKEND_CAMERA_FRAME_URL "https://khrong-ngan.onrender.com/api/kiosk/camera-frame"
#define KIOSK_HEARTBEAT_SECRET "ilovevijai"

#define FIRMWARE_VERSION "1.0.0-kiosk"
// รับคำสั่ง Admin เร็วขึ้น — ESP32 ดึง command ทุกครั้งที่ POST heartbeat นี้
// production อาจใช้ 15000–30000 ถ้าไม่อยากยิง Render บ่อย
#define HEARTBEAT_INTERVAL_MS 5000
#define HEARTBEAT_ACTIVE_INTERVAL_MS 2500
#define CAMERA_FRAME_INTERVAL_MS 500
#define KIOSK_SCAN_DURATION_MS 60000

#define I2C_SDA_PIN 9
#define I2C_SCL_PIN 10
#define PCA9685_I2C_ADDR 0x40
#define DISPENSER_SLOT_COUNT 10
#define PCA9685_PWM_FREQ 50
// MG90S/MG996R 360° — หมุนด้วย SERVO_SPIN_US; หยุด = ตัด PWM (writeServoStop) ไม่ใช่ 1500μs
#define SERVO_STOP_US 1500
#define SERVO_SPIN_US 2000
#define SERVO_SPIN_US_REV 1200
#define SERVO_SPIN_MS 3000
#define SERVO_MAX_SPIN_MS 3500
#define SERVO_ALL_GAP_MS 400   // หน่วงระหว่างช่องตอน dispense_all

// PCA9685 OE — GPIO 11 + 10k pull-up to 3.3V (HIGH=disable PWM)
#define PCA9685_OE_PIN 11
#define ALLOW_DISPENSE_ALL 0
#define DISPENSER_IDLE_STOP_MS 30000

// 1 = หมุนช่อง 0 ตอน boot | 0 = ปิด (แนะนำเมื่อใช้งานจริง)
#define BOOT_SERVO_TEST 0

// ESP32-CAM MAC: 28:05:A5:24:16:AC (byte แรก = 0x28 ไม่ใช่ 0x2B)
#define CAM_ESPNOW_MAC {0x28, 0x05, 0xA5, 0x24, 0x16, 0xAC}
#define CAM_ESPNOW_PING_MS 10000
#define CAM_ESPNOW_TIMEOUT_MS 90000

#define CAM_MSG_PING "PING"
#define CAM_MSG_PONG "PONG"
#define CAM_MSG_SCAN "SCAN"
#define CAM_MSG_SCAN_STOP "SCAN_STOP"
#define CAM_MSG_OK "OK"
#define CAM_MSG_QR_PREFIX "QR:"
#define CAM_MSG_ERR_PREFIX "ERR:"
#define CAM_MSG_IP_PREFIX "IP:"
// ================================================

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiClient.h>
#include <Wire.h>
#include <esp_now.h>
#include <esp_system.h>
#include <ArduinoJson.h>
#include "mbedtls/base64.h"
#include <Adafruit_PWMServoDriver.h>
#include "kiosk_page.h"

WebServer server(80);
Adafruit_PWMServoDriver pwm(PCA9685_I2C_ADDR);

unsigned long lastHeartbeatMs = 0;
unsigned long lastCameraFrameMs = 0;
unsigned long lastWifiRetryMs = 0;
bool pwmReady = false;
bool dispenseBusy = false;
bool pwmOutputsOn = false;
unsigned long lastIdleStopMs = 0;

uint8_t camPeerMac[6] = CAM_ESPNOW_MAC;
bool camOnline = false;
bool camPeerReady = false;
bool espNowStarted = false;
unsigned long lastCamRxMs = 0;
unsigned long lastCamPingMs = 0;
unsigned long lastScanMs = 0;
static char camPreviewUrl[48] = {};

enum KioskPhase : uint8_t {
  KIOSK_IDLE = 0,
  KIOSK_SCANNING,
  KIOSK_PREVIEW,
  KIOSK_DISPENSING,
  KIOSK_SUCCESS,
  KIOSK_ERROR,
};

static KioskPhase kioskPhase = KIOSK_IDLE;
static unsigned long kioskScanUntilMs = 0;
static unsigned long kioskSuccessAtMs = 0;
static unsigned long kioskErrorAtMs = 0;
static bool kioskCloudDirty = false;
static char kioskSessionError[96] = {};
static char kioskPreviewJson[2048] = {};
static char kioskPendingCode[32] = {};
static char kioskPendingSignature[128] = {};

static void kioskMarkCloudDirty() { kioskCloudDirty = true; }

const char* kioskPhaseName();
int kioskSessionCountdownSec();
bool camLinkOnline();
bool dispenserIsBusy();

static void kioskAppendCloudJson(JsonObject sessionOut) {
  sessionOut["phase"] = kioskPhaseName();
  sessionOut["countdownSec"] = kioskSessionCountdownSec();
  sessionOut["camOnline"] = camLinkOnline();
  sessionOut["dispenseBusy"] = dispenserIsBusy();
  if (kioskPhase == KIOSK_SCANNING) {
    const char* previewUrl = camLinkPreviewUrl();
    if (previewUrl && previewUrl[0]) {
      sessionOut["camPreviewUrl"] = previewUrl;
    }
  }
  const char* err = kioskSessionError;
  if (err && err[0] && kioskPhase == KIOSK_ERROR) {
    sessionOut["error"] = err;
  }
  if (kioskPreviewJson[0] && kioskPhase == KIOSK_PREVIEW) {
    JsonDocument previewDoc;
    if (!deserializeJson(previewDoc, kioskPreviewJson)) {
      sessionOut["preview"] = previewDoc.as<JsonObject>();
    }
  }
}

struct {
  bool pending = false;
  char id[40] = {};
  bool ok = true;
  char error[64] = {};
} pendingAck;

const char* wifiStatusText(wl_status_t s) {
  switch (s) {
    case WL_IDLE_STATUS: return "idle";
    case WL_NO_SSID_AVAIL: return "no SSID found";
    case WL_SCAN_COMPLETED: return "scan done";
    case WL_CONNECTED: return "connected";
    case WL_CONNECT_FAILED: return "wrong password";
    case WL_CONNECTION_LOST: return "connection lost";
    case WL_DISCONNECTED: return "disconnected";
    default: return "unknown";
  }
}

void camLinkStart();

bool pickupRedeemAndDispense(const char* code);

bool connectWiFi(unsigned long timeoutMs = 20000) {
  if (WiFi.status() == WL_CONNECTED) return true;

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.disconnect(true, true);
  delay(200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[wifi] connecting to \"%s\"...\n", WIFI_SSID);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < timeoutMs) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] OK — IP %s  RSSI %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
    camLinkStart();
    return true;
  }

  Serial.printf("[wifi] FAILED — status %d (%s)\n",
                WiFi.status(), wifiStatusText(WiFi.status()));
  return false;
}

void writeServoPulse(uint8_t channel, uint16_t pulseUs) {
  if (!pwmReady) return;
  const uint32_t tick = (pulseUs * 4096UL) / 20000UL;
  pwm.setPWM(channel, 0, tick);
  Serial.printf("[dispenser] ch=%u pulse=%uus tick=%lu\n", channel, pulseUs, tick);
}

// MG90S/MG996R 360° — หยุด = ตัด PWM (ไม่ส่ง 1500μs เพราะ 1500 = หมุน idle)
void writeServoStop(uint8_t channel) {
  if (!pwmReady) return;
  pwm.setPWM(channel, 0, 4096);
}

void stopAllServos() {
  if (!pwmReady) return;
  for (uint8_t ch = 0; ch < DISPENSER_SLOT_COUNT; ch++) {
    pwm.setPWM(ch, 0, 4096);
  }
}

void pwmOutputsEnable(bool enable) {
#if PCA9685_OE_PIN >= 0
  pinMode(PCA9685_OE_PIN, OUTPUT);
  digitalWrite(PCA9685_OE_PIN, enable ? LOW : HIGH);
  pwmOutputsOn = enable;
#else
  (void)enable;
  pwmOutputsOn = true;
#endif
}

void spinWaitMs(uint16_t durationMs) {
  const unsigned long deadline = millis() + durationMs;
  while ((long)(millis() - deadline) < 0) {
    yield();
    server.handleClient();
  }
}

class DispenseSlotGuard {
 public:
  explicit DispenseSlotGuard(uint8_t channel) : channel_(channel), active_(true) {
    dispenseBusy = true;
  }
  ~DispenseSlotGuard() {
    if (active_) {
      writeServoStop(channel_);
      dispenseBusy = false;
    }
  }
  DispenseSlotGuard(const DispenseSlotGuard&) = delete;
  DispenseSlotGuard& operator=(const DispenseSlotGuard&) = delete;

 private:
  uint8_t channel_;
  bool active_;
};

void dispenserPreBoot() {
#if PCA9685_OE_PIN >= 0
  pinMode(PCA9685_OE_PIN, OUTPUT);
  digitalWrite(PCA9685_OE_PIN, HIGH);
  pwmOutputsOn = false;
#endif
}

bool dispenserIsBusy() { return dispenseBusy; }
bool dispenserPwmReady() { return pwmReady; }
bool dispenserServoSafe() { return !dispenseBusy; }

bool probeI2cDevice(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

void scanI2cBus() {
  Serial.println("[diag] I2C scan SDA=GPIO9 SCL=GPIO10:");
  uint8_t found = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf("[diag]   device 0x%02X\n", addr);
      found++;
    }
  }
  if (found == 0) {
    Serial.println("[diag]   NO devices — ตรวจ SDA/SCL/GND หรือ PCA9685 ไม่ได้ไฟ");
  }
}

void spinChannel(uint8_t slotIndex, uint16_t pulseUs, uint16_t durationMs) {
  Serial.printf("[diag] spin ch=%u pulse=%uus for %ums\n", slotIndex, pulseUs, durationMs);
  writeServoPulse(slotIndex, pulseUs);
  delay(durationMs);
  writeServoStop(slotIndex);
}

void runBootServoTest() {
  Serial.println("[diag] === BOOT SERVO TEST ch0 ===");
  Serial.println("[diag] ต้องมี: ไฟ 5V ที่ V+ ขั้วนอต PCA9685 + GND ร่วม + servo ช่อง 0");
  Serial.println("[diag] ถ้าไม่หมุน → ตรวจไฟ 5V V+ / OE→GPIO11+pull-up / servo");
  delay(1000);
  spinChannel(0, SERVO_SPIN_US, 1500);
  delay(500);
  spinChannel(0, SERVO_SPIN_US_REV, 1500);
  Serial.println("[diag] === BOOT TEST DONE ===");
}

void handleSerialDiag() {
  if (!Serial.available()) return;
  String line = Serial.readStringUntil('\n');
  line.trim();
  if (line.length() == 0) return;

  if (line == "scan") {
    scanI2cBus();
    return;
  }
  if (line == "test" || line == "test 0") {
    runBootServoTest();
    return;
  }
  if (line.startsWith("test ")) {
    const int ch = line.substring(5).toInt();
    if (ch < 0 || ch > 9) {
      Serial.println("[diag] usage: test 0..9");
      return;
    }
    spinChannel(static_cast<uint8_t>(ch), SERVO_SPIN_US, 1500);
    delay(500);
    spinChannel(static_cast<uint8_t>(ch), SERVO_SPIN_US_REV, 1500);
    return;
  }
  if (line.startsWith("pulse ")) {
    // pulse 0 1700 2000  → ช่อง pulseUs ระยะ ms
    const int sp1 = line.indexOf(' ');
    const int sp2 = line.indexOf(' ', sp1 + 1);
    const int sp3 = line.indexOf(' ', sp2 + 1);
    if (sp3 < 0) {
      Serial.println("[diag] usage: pulse <ch> <us> <ms>  e.g. pulse 0 1700 2000");
      return;
    }
    const int ch = line.substring(sp1 + 1, sp2).toInt();
    const int us = line.substring(sp2 + 1, sp3).toInt();
    const int ms = line.substring(sp3 + 1).toInt();
    if (ch < 0 || ch > 9 || us < 500 || us > 2500 || ms < 100 || ms > 10000) {
      Serial.println("[diag] invalid args");
      return;
    }
    spinChannel(static_cast<uint8_t>(ch), static_cast<uint16_t>(us), static_cast<uint16_t>(ms));
    return;
  }
  Serial.println("[diag] commands: scan | test | test 0..9 | pulse <ch> <us> <ms>");
}

void dispenserSetup() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Serial.printf("[dispenser] I2C SDA=GPIO%d SCL=GPIO%d slots=%d\n",
                I2C_SDA_PIN, I2C_SCL_PIN, DISPENSER_SLOT_COUNT);

#if PCA9685_OE_PIN >= 0
  Serial.printf("[dispenser] OE on GPIO%d (HIGH=disable PWM)\n", PCA9685_OE_PIN);
#endif

  scanI2cBus();
  if (!probeI2cDevice(PCA9685_I2C_ADDR)) {
    Serial.printf("[dispenser] ERROR: PCA9685 0x%02X not found on I2C!\n", PCA9685_I2C_ADDR);
    Serial.println("[dispenser] → ตรวจ SDA/SCL, ที่อยู่ A0-A5, ไฟ 3.3V VCC");
    pwmReady = false;
    return;
  }

  if (!pwm.begin()) {
    Serial.println("[dispenser] ERROR: pwm.begin() failed");
    pwmReady = false;
    return;
  }
  pwm.setOscillatorFrequency(27000000);
  pwm.setPWMFreq(PCA9685_PWM_FREQ);
  pwmReady = true;
  stopAllServos();
  pwmOutputsEnable(true);
  Serial.println("[dispenser] PCA9685 ready — all channels stopped");
  Serial.println("[dispenser] ⚠ servo ต้องมีไฟ 5V ที่ขั้ว V+ ของ PCA9685 (ไม่ใช่แค่ 3.3V logic)");
#if BOOT_SERVO_TEST
  runBootServoTest();
#endif
  lastIdleStopMs = millis();
}

void dispenserLoop() {
  if (dispenseBusy || !pwmReady) return;
  const unsigned long now = millis();
  if (now - lastIdleStopMs < DISPENSER_IDLE_STOP_MS) return;
  stopAllServos();
  lastIdleStopMs = now;
}

bool dispenserDispenseSlot(uint8_t slotIndex) {
  if (!pwmReady) {
    Serial.println("[dispenser] ERROR: PCA9685 not ready — ไม่หมุน servo");
    return false;
  }
  if (dispenseBusy) {
    Serial.println("[dispenser] rejected — dispense busy");
    return false;
  }
  if (slotIndex >= DISPENSER_SLOT_COUNT) return false;
  Serial.printf("[web-cmd] spinning PCA9685 channel %u\n", slotIndex);
  Serial.printf("[dispenser] spin slot %u\n", slotIndex);

  DispenseSlotGuard guard(static_cast<uint8_t>(slotIndex));
  writeServoPulse(slotIndex, SERVO_SPIN_US);
  spinWaitMs(SERVO_SPIN_MS);
  return true;
}

bool dispenserDispenseAll() {
  if (!pwmReady) {
    Serial.println("[dispenser] ERROR: PCA9685 not ready — ไม่หมุน servo");
    return false;
  }
  if (dispenseBusy) {
    Serial.println("[dispenser] rejected — dispense busy");
    return false;
  }
  Serial.println("[web-cmd] dispense_all — spinning channels 0-9");
  bool allOk = true;
  for (uint8_t ch = 0; ch < DISPENSER_SLOT_COUNT; ch++) {
    if (!dispenserDispenseSlot(ch)) allOk = false;
    if (ch + 1 < DISPENSER_SLOT_COUNT) spinWaitMs(SERVO_ALL_GAP_MS);
  }
  Serial.printf("[web-cmd] dispense_all done ok=%s\n", allOk ? "true" : "false");
  return allOk;
}

static bool isPlaceholderMac(const uint8_t* mac) {
  return mac[0] == 0xFF && mac[1] == 0xFF && mac[2] == 0xFF &&
         mac[3] == 0xFF && mac[4] == 0xFF && mac[5] == 0xFF;
}

const char* kioskPhaseName() {
  switch (kioskPhase) {
    case KIOSK_SCANNING: return "scanning";
    case KIOSK_PREVIEW: return "preview";
    case KIOSK_DISPENSING: return "dispensing";
    case KIOSK_SUCCESS: return "success";
    case KIOSK_ERROR: return "error";
    default: return "idle";
  }
}

bool sendCamMessage(const char* msg);

bool camLinkPeerReady() { return camPeerReady; }

bool camLinkOnline() { return camOnline; }

const char* camLinkPreviewUrl() {
  return camPreviewUrl[0] ? camPreviewUrl : nullptr;
}

bool camLinkRequestScan() {
  for (int attempt = 0; attempt < 3; attempt++) {
    if (sendCamMessage(CAM_MSG_SCAN)) return true;
    delay(50);
  }
  Serial.println("[cam] SCAN send failed after retries");
  return false;
}

void camLinkRequestScanStop() {
  sendCamMessage(CAM_MSG_SCAN_STOP);
}

void kioskSessionReset() {
  kioskPhase = KIOSK_IDLE;
  kioskScanUntilMs = 0;
  kioskSessionError[0] = '\0';
  kioskPreviewJson[0] = '\0';
  kioskPendingCode[0] = '\0';
  kioskPendingSignature[0] = '\0';
  camLinkRequestScanStop();
  kioskMarkCloudDirty();
}

static void mapHttpError(int status, String& errorOut) {
  switch (status) {
    case 401:
      errorOut = "unauthorized";
      break;
    case 404:
      errorOut = "ticket not found";
      break;
    case 410:
      errorOut = "ticket expired";
      break;
    default:
      errorOut = "preview failed";
      break;
  }
}

bool postKioskTicketUrl(
    const char* url,
    const char* code,
    const char* signature,
    String& response,
    String& errorOut) {
  if (WiFi.status() != WL_CONNECTED || !code || !code[0]) {
    errorOut = "preview failed";
    return false;
  }
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, url);
  http.setTimeout(30000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Kiosk-Secret", KIOSK_HEARTBEAT_SECRET);
  JsonDocument doc;
  doc["code"] = code;
  if (signature && signature[0]) doc["signature"] = signature;
  String body;
  serializeJson(doc, body);
  const int status = http.POST(body);
  response = http.getString();
  if (status < 200 || status >= 300) {
    Serial.printf("[pickup] HTTP %d (%s) body=%s\n", status, url, response.c_str());
    http.end();
    mapHttpError(status, errorOut);
    return false;
  }
  http.end();
  return true;
}

bool pickupPreviewTicket(
    const char* code,
    const char* signature,
    String& outJson,
    String& errorOut) {
  errorOut = "";
  String response;
  if (!postKioskTicketUrl(BACKEND_PREVIEW_URL, code, signature, response, errorOut)) {
    if (errorOut.length() == 0) errorOut = "preview failed";
    return false;
  }
  JsonDocument res;
  if (deserializeJson(res, response)) {
    errorOut = "preview failed";
    return false;
  }
  if (!res["ok"].as<bool>()) {
    const char* err = res["error"] | "preview failed";
    errorOut = err;
    return false;
  }
  outJson = response;
  return true;
}

bool kioskSessionOnQrCode(const char* code, const char* signature) {
  if (!code || !code[0]) return false;
  if (kioskPhase != KIOSK_SCANNING && kioskPhase != KIOSK_PREVIEW) return false;
  strncpy(kioskPendingCode, code, sizeof(kioskPendingCode) - 1);
  kioskPendingCode[sizeof(kioskPendingCode) - 1] = '\0';
  if (signature && signature[0]) {
    strncpy(kioskPendingSignature, signature, sizeof(kioskPendingSignature) - 1);
    kioskPendingSignature[sizeof(kioskPendingSignature) - 1] = '\0';
  } else {
    kioskPendingSignature[0] = '\0';
  }
  String previewBody;
  String previewError;
  if (!pickupPreviewTicket(
          kioskPendingCode,
          kioskPendingSignature[0] ? kioskPendingSignature : nullptr,
          previewBody,
          previewError)) {
    kioskPhase = KIOSK_ERROR;
    const char* err = previewError.length() ? previewError.c_str() : "preview failed";
    strncpy(kioskSessionError, err, sizeof(kioskSessionError) - 1);
    kioskSessionError[sizeof(kioskSessionError) - 1] = '\0';
    camLinkRequestScanStop();
    kioskMarkCloudDirty();
    return false;
  }
  if (previewBody.length() >= sizeof(kioskPreviewJson)) {
    kioskPhase = KIOSK_ERROR;
    strncpy(kioskSessionError, "preview too large", sizeof(kioskSessionError) - 1);
    kioskSessionError[sizeof(kioskSessionError) - 1] = '\0';
    kioskMarkCloudDirty();
    return false;
  }
  strncpy(kioskPreviewJson, previewBody.c_str(), sizeof(kioskPreviewJson) - 1);
  kioskPreviewJson[sizeof(kioskPreviewJson) - 1] = '\0';
  kioskPhase = KIOSK_PREVIEW;
  kioskScanUntilMs = 0;
  camLinkRequestScanStop();
  kioskMarkCloudDirty();
  return true;
}

void kioskSessionOnScanError(const char* msg) {
  if (kioskPhase != KIOSK_SCANNING) return;
  kioskPhase = KIOSK_ERROR;
  kioskScanUntilMs = 0;
  if (msg && msg[0] && strcmp(msg, "timeout") == 0) {
    strncpy(kioskSessionError, "scan timeout", sizeof(kioskSessionError) - 1);
  } else if (msg && msg[0]) {
    strncpy(kioskSessionError, msg, sizeof(kioskSessionError) - 1);
  } else {
    strncpy(kioskSessionError, "scan timeout", sizeof(kioskSessionError) - 1);
  }
  kioskSessionError[sizeof(kioskSessionError) - 1] = '\0';
  camLinkRequestScanStop();
  Serial.printf("[kiosk] scan error: %s\n", kioskSessionError);
  kioskMarkCloudDirty();
}

bool kioskSessionStartScan() {
  if (kioskPhase == KIOSK_DISPENSING) return false;
  kioskSessionError[0] = '\0';
  kioskPreviewJson[0] = '\0';
  kioskPendingCode[0] = '\0';
  kioskPendingSignature[0] = '\0';
  if (!camLinkRequestScan()) return false;
  kioskPhase = KIOSK_SCANNING;
  kioskScanUntilMs = millis() + KIOSK_SCAN_DURATION_MS;
  Serial.printf("[kiosk] scan started (%us)\n", KIOSK_SCAN_DURATION_MS / 1000);
  kioskMarkCloudDirty();
  return true;
}

void kioskSessionCancelScan() {
  kioskSessionReset();
  kioskMarkCloudDirty();
}

bool kioskSessionConfirmPickup() {
  if (kioskPhase != KIOSK_PREVIEW || !kioskPendingCode[0]) return false;
  if (dispenserIsBusy()) {
    Serial.println("[kiosk] confirm rejected — dispense busy");
    return false;
  }
  kioskPhase = KIOSK_DISPENSING;
  kioskMarkCloudDirty();
  const bool ok = pickupRedeemAndDispense(kioskPendingCode);
  if (ok) {
    kioskPhase = KIOSK_SUCCESS;
    kioskPreviewJson[0] = '\0';
    kioskPendingCode[0] = '\0';
    kioskMarkCloudDirty();
    return true;
  }
  kioskPhase = KIOSK_ERROR;
  strncpy(kioskSessionError, "dispense failed", sizeof(kioskSessionError) - 1);
  kioskMarkCloudDirty();
  return false;
}

void kioskSessionLoop() {
  if (kioskPhase == KIOSK_SCANNING && kioskScanUntilMs > 0 && millis() > kioskScanUntilMs) {
    kioskSessionOnScanError("timeout");
    Serial.println("[kiosk] scan timeout");
  }
  if (kioskPhase == KIOSK_SUCCESS) {
    if (kioskSuccessAtMs == 0) kioskSuccessAtMs = millis();
    if (millis() - kioskSuccessAtMs > 3000) {
      kioskSuccessAtMs = 0;
      kioskSessionReset();
    }
  } else {
    kioskSuccessAtMs = 0;
  }
  if (kioskPhase == KIOSK_ERROR) {
    if (kioskErrorAtMs == 0) kioskErrorAtMs = millis();
    if (millis() - kioskErrorAtMs > 8000) {
      kioskErrorAtMs = 0;
      kioskSessionReset();
      Serial.println("[kiosk] error cleared → idle");
    }
  } else {
    kioskErrorAtMs = 0;
  }
}

int kioskSessionCountdownSec() {
  if (kioskPhase != KIOSK_SCANNING || kioskScanUntilMs == 0) return 0;
  const long ms = static_cast<long>(kioskScanUntilMs - millis());
  return ms <= 0 ? 0 : static_cast<int>((ms + 999) / 1000);
}

bool pickupRedeemAndDispense(const char* code) {
  String response;
  String errorOut;
  if (!postKioskTicketUrl(BACKEND_REDEEM_URL, code, nullptr, response, errorOut)) {
    Serial.println("[pickup] redeem failed");
    return false;
  }

  JsonDocument res;
  if (deserializeJson(res, response)) {
    Serial.println("[pickup] invalid redeem JSON");
    return false;
  }

  if (!res["ok"].as<bool>()) {
    Serial.println("[pickup] redeem not ok");
    return false;
  }

  const int channel = res["channel"] | -1;
  const char* slotId = res["slotId"] | "?";
  if (channel < 0 || channel > 9) {
    Serial.println("[pickup] invalid channel");
    return false;
  }

  Serial.printf("[pickup] redeem ok slot=%s ch=%d — dispense\n", slotId, channel);
  const bool ok = dispenserDispenseSlot(static_cast<uint8_t>(channel));
  Serial.printf("[pickup] dispense %s\n", ok ? "ok" : "fail");
  return ok;
}

static void handleCamPayload(const uint8_t* data, int len) {
  if (len <= 0) return;
  char buf[251];
  const int n = len < 250 ? len : 250;
  memcpy(buf, data, n);
  buf[n] = '\0';

  if (strcmp(buf, CAM_MSG_PONG) == 0 || strcmp(buf, CAM_MSG_OK) == 0) {
    camOnline = true;
    lastCamRxMs = millis();
  } else if (strncmp(buf, CAM_MSG_QR_PREFIX, strlen(CAM_MSG_QR_PREFIX)) == 0) {
    camOnline = true;
    lastCamRxMs = millis();
    const char* payload = buf + strlen(CAM_MSG_QR_PREFIX);
    if (payload[0] == '{') {
      JsonDocument qrDoc;
      if (!deserializeJson(qrDoc, payload)) {
        const char* code = qrDoc["code"] | "";
        const char* signature = qrDoc["signature"] | qrDoc["sig"] | "";
        if (code[0]) kioskSessionOnQrCode(code, signature[0] ? signature : nullptr);
      }
    } else if (payload[0]) {
      kioskSessionOnQrCode(payload, nullptr);
    }
  } else if (strncmp(buf, CAM_MSG_ERR_PREFIX, strlen(CAM_MSG_ERR_PREFIX)) == 0) {
    camOnline = true;
    lastCamRxMs = millis();
    kioskSessionOnScanError(buf + strlen(CAM_MSG_ERR_PREFIX));
  } else if (strncmp(buf, CAM_MSG_IP_PREFIX, strlen(CAM_MSG_IP_PREFIX)) == 0) {
    camOnline = true;
    lastCamRxMs = millis();
    const char* ip = buf + strlen(CAM_MSG_IP_PREFIX);
    snprintf(camPreviewUrl, sizeof(camPreviewUrl), "http://%s:81/jpg", ip);
    Serial.printf("[cam] preview url %s\n", camPreviewUrl);
  }
  Serial.printf("[cam] ESP-NOW << %s\n", buf);
}

#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
void onCamEspNowRecv(const esp_now_recv_info_t* info, const uint8_t* data, int len) {
  (void)info;
  handleCamPayload(data, len);
}
#else
void onCamEspNowRecv(const uint8_t* mac, const uint8_t* data, int len) {
  (void)mac;
  handleCamPayload(data, len);
}
#endif

bool addCamPeer() {
  if (isPlaceholderMac(camPeerMac)) {
    Serial.println("[cam] ตั้ง CAM_ESPNOW_MAC จาก MAC บน Serial ของ ESP32-CAM");
    return false;
  }

  const uint8_t ch = (WiFi.status() == WL_CONNECTED) ? WiFi.channel() : 1;

  if (esp_now_is_peer_exist(camPeerMac)) {
    esp_now_peer_info_t existing = {};
    if (esp_now_get_peer(camPeerMac, &existing) == ESP_OK && existing.channel == ch) {
      camPeerReady = true;
      return true;
    }
    esp_now_del_peer(camPeerMac);
    Serial.printf("[cam] peer channel changed → re-add ch=%d\n", ch);
  }

  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, camPeerMac, 6);
  peer.channel = ch;
  peer.encrypt = false;
  peer.ifidx = WIFI_IF_STA;

  if (esp_now_add_peer(&peer) != ESP_OK) {
    Serial.println("[cam] esp_now_add_peer failed");
    camPeerReady = false;
    return false;
  }

  camPeerReady = true;
  Serial.printf("[cam] peer CAM %02X:%02X:%02X:%02X:%02X:%02X ch=%d\n",
                camPeerMac[0], camPeerMac[1], camPeerMac[2],
                camPeerMac[3], camPeerMac[4], camPeerMac[5], peer.channel);
  return true;
}

bool sendCamMessage(const char* msg) {
  if (!espNowStarted || !camPeerReady || !msg || !msg[0]) return false;
  const esp_err_t err =
      esp_now_send(camPeerMac, reinterpret_cast<const uint8_t*>(msg), strlen(msg));
  Serial.printf("[cam] ESP-NOW >> %s (%s)\n", msg, err == ESP_OK ? "ok" : "fail");
  return err == ESP_OK;
}

void camLinkStart() {
  if (espNowStarted) {
    esp_now_deinit();
    espNowStarted = false;
    camPeerReady = false;
    camOnline = false;
  }

  if (esp_now_init() != ESP_OK) {
    Serial.println("[cam] esp_now_init failed");
    return;
  }

  esp_now_register_recv_cb(onCamEspNowRecv);
  espNowStarted = true;

  if (addCamPeer()) {
    sendCamMessage(CAM_MSG_PING);
    lastCamPingMs = millis();
  }
}

void camLinkSetup() {
  Serial.printf("[cam] S3 MAC %s\n", WiFi.macAddress().c_str());
  camLinkStart();
}

void camLinkLoop() {
  const unsigned long now = millis();

  if (!camPeerReady && !isPlaceholderMac(camPeerMac)) {
    addCamPeer();
  }

  if (camPeerReady && now - lastCamPingMs >= CAM_ESPNOW_PING_MS) {
    sendCamMessage(CAM_MSG_PING);
    lastCamPingMs = now;
  }

  if (camOnline && now - lastCamRxMs > CAM_ESPNOW_TIMEOUT_MS) {
    camOnline = false;
  }
}

void queueAck(const char* id, bool ok, const char* errMsg = nullptr) {
  pendingAck.pending = true;
  strncpy(pendingAck.id, id, sizeof(pendingAck.id) - 1);
  pendingAck.ok = ok;
  if (errMsg && errMsg[0]) {
    strncpy(pendingAck.error, errMsg, sizeof(pendingAck.error) - 1);
  } else {
    pendingAck.error[0] = '\0';
  }
  Serial.printf("[web-cmd] done %s — ack queued id=%s\n", ok ? "ok" : "fail", id);
}

String buildHeartbeatBody() {
  JsonDocument doc;
  doc["online"] = true;
  doc["lat"] = KIOSK_LAT;
  doc["lng"] = KIOSK_LNG;
  doc["name"] = KIOSK_NAME;
  doc["device"] = "esp32-s3";
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["rssi"] = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0;

  JsonObject session = doc["session"].to<JsonObject>();
  kioskAppendCloudJson(session);

  if (pendingAck.pending) {
    JsonObject ack = doc["commandAck"].to<JsonObject>();
    ack["id"] = pendingAck.id;
    ack["ok"] = pendingAck.ok;
    if (pendingAck.error[0]) {
      ack["error"] = pendingAck.error;
    }
    Serial.printf("[web-cmd] ack sent id=%s ok=%s\n",
                  pendingAck.id, pendingAck.ok ? "true" : "false");
    pendingAck.pending = false;
  }

  String out;
  serializeJson(doc, out);
  return out;
}

String buildSessionSyncBody() {
  JsonDocument doc;
  JsonObject session = doc["session"].to<JsonObject>();
  kioskAppendCloudJson(session);
  String out;
  serializeJson(doc, out);
  return out;
}

bool postCloudJson(const char* url, const String& body) {
  if (WiFi.status() != WL_CONNECTED) return false;
  if (strlen(KIOSK_HEARTBEAT_SECRET) == 0) return false;
  if (!url || !url[0]) return false;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, url);
  http.setTimeout(20000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Kiosk-Secret", KIOSK_HEARTBEAT_SECRET);
  const int code = http.POST(body);
  const bool ok = code >= 200 && code < 300;
  if (!ok && code > 0) {
    Serial.printf("[cloud-sync] HTTP %d (%s)\n", code, url);
  }
  http.end();
  return ok;
}

bool encodeJpegBase64(const uint8_t* data, size_t len, String& out) {
  if (!data || len == 0) return false;
  size_t olen = 0;
  if (mbedtls_base64_encode(nullptr, 0, &olen, data, len) != MBEDTLS_ERR_BASE64_BUFFER_TOO_SMALL) {
    return false;
  }
  unsigned char* buf = new unsigned char[olen + 1];
  const bool ok =
      mbedtls_base64_encode(buf, olen + 1, &olen, data, len) == 0;
  if (ok) {
    out = String(reinterpret_cast<const char*>(buf), olen);
  }
  delete[] buf;
  return ok;
}

void relayCameraFrameIfScanning() {
  if (kioskPhase != KIOSK_SCANNING) return;
  if (millis() - lastCameraFrameMs < CAMERA_FRAME_INTERVAL_MS) return;

  const char* previewUrl = camLinkPreviewUrl();
  if (!previewUrl || !previewUrl[0]) return;
  if (WiFi.status() != WL_CONNECTED) return;
  if (strlen(BACKEND_CAMERA_FRAME_URL) == 0) return;
  if (strlen(KIOSK_HEARTBEAT_SECRET) == 0) return;

  lastCameraFrameMs = millis();

  WiFiClient camClient;
  HTTPClient camHttp;
  camHttp.begin(camClient, previewUrl);
  camHttp.setTimeout(4000);
  const int camCode = camHttp.GET();
  if (camCode != HTTP_CODE_OK) {
    camHttp.end();
    return;
  }

  const String jpeg = camHttp.getString();
  camHttp.end();

  if (jpeg.length() < 100 || jpeg.length() > 512000) return;

  String b64;
  if (!encodeJpegBase64(reinterpret_cast<const uint8_t*>(jpeg.c_str()), jpeg.length(), b64)) {
    return;
  }

  JsonDocument doc;
  doc["jpegBase64"] = b64;
  String body;
  serializeJson(doc, body);
  postCloudJson(BACKEND_CAMERA_FRAME_URL, body);
}

void pushSessionSyncIfDirty() {
  if (!kioskCloudDirty) return;
  const String body = buildSessionSyncBody();
  if (postCloudJson(BACKEND_SESSION_SYNC_URL, body)) {
    kioskCloudDirty = false;
    Serial.println("[cloud-sync] session pushed");
  }
}

void sendHeartbeat();

void handleDisplayCommand(const char* id, const char* action) {
  bool ok = false;
  const char* errMsg = nullptr;

  if (strcmp(action, "scan_start") == 0) {
    Serial.printf("[web-cmd] received scan_start id=%s\n", id);
    ok = kioskSessionStartScan();
    if (!ok) errMsg = "scan start failed";
  } else if (strcmp(action, "scan_cancel") == 0) {
    Serial.printf("[web-cmd] received scan_cancel id=%s\n", id);
    kioskSessionCancelScan();
    ok = true;
  } else if (strcmp(action, "confirm_pickup") == 0) {
    Serial.printf("[web-cmd] received confirm_pickup id=%s\n", id);
    ok = kioskSessionConfirmPickup();
    if (!ok) errMsg = "confirm failed";
  } else {
    Serial.println("[web-cmd] ignored invalid command");
    return;
  }

  queueAck(id, ok, ok ? nullptr : errMsg);
  pushSessionSyncIfDirty();
  sendHeartbeat();
  lastHeartbeatMs = millis();
}

void handleCommandFromResponse(const String& response) {
  JsonDocument doc;
  if (deserializeJson(doc, response)) {
    Serial.println("[heartbeat] invalid JSON response");
    return;
  }

  JsonObject cmd = doc["command"];
  if (cmd.isNull()) return;

  const char* id = cmd["id"] | "";
  const char* action = cmd["action"] | "";
  const int slot = cmd["slot"] | -1;

  if (!id[0]) {
    Serial.println("[web-cmd] ignored invalid command");
    return;
  }

  if (strcmp(action, "scan_start") == 0 ||
      strcmp(action, "scan_cancel") == 0 ||
      strcmp(action, "confirm_pickup") == 0) {
    if (dispenserIsBusy() && strcmp(action, "scan_cancel") != 0 &&
        strcmp(action, "confirm_pickup") != 0) {
      Serial.println("[web-cmd] rejected — dispense busy");
      queueAck(id, false, "busy");
      sendHeartbeat();
      lastHeartbeatMs = millis();
      return;
    }
    handleDisplayCommand(id, action);
    return;
  }

  if (dispenserIsBusy()) {
    Serial.println("[web-cmd] rejected — dispense busy");
    queueAck(id, false, "busy");
    sendHeartbeat();
    lastHeartbeatMs = millis();
    return;
  }

  bool ok = false;
  if (strcmp(action, "dispense_all") == 0) {
#if !ALLOW_DISPENSE_ALL
    Serial.println("[web-cmd] rejected dispense_all (disabled in production)");
    queueAck(id, false, "dispense_all disabled");
    sendHeartbeat();
    lastHeartbeatMs = millis();
    return;
#else
    Serial.printf("[web-cmd] received dispense_all id=%s\n", id);
    ok = dispenserDispenseAll();
#endif
  } else if (strcmp(action, "dispense") == 0 && slot >= 0 && slot <= 9) {
    Serial.printf("[web-cmd] received dispense slot=%d id=%s\n", slot, id);
    ok = dispenserDispenseSlot(static_cast<uint8_t>(slot));
  } else {
    Serial.println("[web-cmd] ignored invalid command");
    return;
  }

  queueAck(id, ok, ok ? nullptr : "dispense failed");
  sendHeartbeat();
  lastHeartbeatMs = millis();
}

void sendCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, X-Kiosk-Secret");
}

void handleKioskPage() {
  server.send_P(200, "text/html; charset=utf-8", KIOSK_PAGE_HTML);
}

void handleHealth() {
  sendCorsHeaders();
  server.send(200, "application/json", "{\"ok\":true,\"device\":\"esp32-s3\"}");
}

void handleStatus() {
  sendCorsHeaders();
  JsonDocument doc;
  doc["online"] = WiFi.status() == WL_CONNECTED;
  doc["lat"] = KIOSK_LAT;
  doc["lng"] = KIOSK_LNG;
  doc["name"] = KIOSK_NAME;
  doc["device"] = "esp32-s3";
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["rssi"] = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0;
  doc["camOnline"] = camOnline;
  doc["phase"] = kioskPhaseName();
  doc["dispenseBusy"] = dispenserIsBusy();
  doc["pwmReady"] = dispenserPwmReady();
  doc["servoSafe"] = dispenserServoSafe();
  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handleKioskSession() {
  sendCorsHeaders();
  JsonDocument doc;
  doc["phase"] = kioskPhaseName();
  doc["countdownSec"] = kioskSessionCountdownSec();
  doc["camOnline"] = camOnline;
  doc["dispenseBusy"] = dispenserIsBusy();
  doc["pwmReady"] = dispenserPwmReady();
  doc["servoSafe"] = dispenserServoSafe();
  const char* previewUrl = camLinkPreviewUrl();
  if (previewUrl && previewUrl[0] && kioskPhase == KIOSK_SCANNING) {
    doc["camPreviewUrl"] = previewUrl;
  }
  if (kioskSessionError[0]) doc["error"] = kioskSessionError;
  if (kioskPreviewJson[0]) {
    JsonDocument previewDoc;
    if (!deserializeJson(previewDoc, kioskPreviewJson)) {
      doc["preview"] = previewDoc.as<JsonObject>();
    }
  }
  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handleScanStart() {
  sendCorsHeaders();
  if (!camLinkPeerReady()) {
    server.send(503, "application/json", "{\"error\":\"cam peer not ready\"}");
    return;
  }
  if (!camLinkOnline()) {
    Serial.println("[kiosk] scan start — cam not pinged yet, trying SCAN anyway");
  }
  if (!kioskSessionStartScan()) {
    server.send(503, "application/json", "{\"error\":\"scan start failed\"}");
    return;
  }
  server.send(200, "application/json", "{\"ok\":true,\"phase\":\"scanning\"}");
}

void handleScanCancel() {
  sendCorsHeaders();
  kioskSessionCancelScan();
  server.send(200, "application/json", "{\"ok\":true,\"phase\":\"idle\"}");
}

void handlePickupConfirm() {
  sendCorsHeaders();
  if (dispenserIsBusy()) {
    server.send(409, "application/json", "{\"ok\":false,\"error\":\"dispense busy\"}");
    return;
  }
  if (kioskSessionConfirmPickup()) {
    server.send(200, "application/json", "{\"ok\":true,\"phase\":\"success\"}");
  } else {
    server.send(500, "application/json", "{\"ok\":false,\"error\":\"confirm failed\"}");
  }
}

void handleOptions() {
  sendCorsHeaders();
  server.send(204);
}

bool authorizeKioskRequest() {
  if (strlen(KIOSK_HEARTBEAT_SECRET) == 0) return false;
  return server.header("X-Kiosk-Secret") == KIOSK_HEARTBEAT_SECRET;
}

void handleDispense() {
  sendCorsHeaders();
  if (!authorizeKioskRequest()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\"}");
    return;
  }
  if (dispenserIsBusy()) {
    server.send(409, "application/json", "{\"error\":\"dispense busy\"}");
    return;
  }

  JsonDocument doc;
  if (deserializeJson(doc, server.arg("plain"))) {
    server.send(400, "application/json", "{\"error\":\"invalid json\"}");
    return;
  }

  const int slot = doc["slot"] | -1;
  if (slot < 0 || slot > 9) {
    server.send(400, "application/json", "{\"error\":\"invalid slot\"}");
    return;
  }

  Serial.printf("[web-cmd] LAN POST /dispense slot=%d\n", slot);
  const bool ok = dispenserDispenseSlot(static_cast<uint8_t>(slot));
  if (ok) {
    server.send(200, "application/json", "{\"ok\":true,\"slot\":" + String(slot) + "}");
  } else {
    server.send(500, "application/json", "{\"error\":\"dispense failed\"}");
  }
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (strlen(KIOSK_HEARTBEAT_SECRET) == 0) return;

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, BACKEND_HEARTBEAT_URL);
  http.setTimeout(45000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Kiosk-Secret", KIOSK_HEARTBEAT_SECRET);

  const String body = buildHeartbeatBody();
  const int code = http.POST(body);

  if (code >= 200 && code < 300) {
    const String response = http.getString();
    Serial.printf("[heartbeat] HTTP %d\n", code);
    handleCommandFromResponse(response);
  } else if (code > 0) {
    Serial.printf("[heartbeat] HTTP %d\n", code);
  } else {
    Serial.printf("[heartbeat] error %d (%s)\n", code, http.errorToString(code).c_str());
  }
  http.end();
}

void setup() {
  dispenserPreBoot();
  dispenserSetup();

  Serial.begin(115200);
  delay(100);
  const esp_reset_reason_t reason = esp_reset_reason();
  const char* reasonText = "unknown";
  switch (reason) {
    case ESP_RST_POWERON: reasonText = "power_on"; break;
    case ESP_RST_EXT: reasonText = "external"; break;
    case ESP_RST_SW: reasonText = "software"; break;
    case ESP_RST_PANIC: reasonText = "panic"; break;
    case ESP_RST_INT_WDT: reasonText = "int_wdt"; break;
    case ESP_RST_TASK_WDT: reasonText = "task_wdt"; break;
    case ESP_RST_WDT: reasonText = "wdt"; break;
    case ESP_RST_BROWNOUT: reasonText = "brownout"; break;
    default: break;
  }
  Serial.printf("[boot] reset reason: %s\n", reasonText);
  Serial.println("[boot] LaneYa ESP32-S3 Kiosk (web-cmd + PCA9685 + ESP-NOW)");

  connectWiFi();
  Serial.printf("[cam] S3 MAC %s\n", WiFi.macAddress().c_str());
  if (!espNowStarted) {
    camLinkStart();
  }

  server.on("/kiosk", HTTP_GET, handleKioskPage);
  server.on("/kiosk/", HTTP_GET, handleKioskPage);
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/kiosk/session", HTTP_GET, handleKioskSession);
  server.on("/kiosk/scan/start", HTTP_POST, handleScanStart);
  server.on("/kiosk/scan/cancel", HTTP_POST, handleScanCancel);
  server.on("/kiosk/scan/cancel", HTTP_GET, handleScanCancel);
  server.on("/kiosk/pickup/confirm", HTTP_POST, handlePickupConfirm);
  server.on("/kiosk/session", HTTP_OPTIONS, handleOptions);
  server.on("/kiosk/scan/start", HTTP_OPTIONS, handleOptions);
  server.on("/kiosk/scan/cancel", HTTP_OPTIONS, handleOptions);
  server.on("/kiosk/pickup/confirm", HTTP_OPTIONS, handleOptions);
  server.on("/dispense", HTTP_POST, handleDispense);
  server.onNotFound([]() {
    sendCorsHeaders();
    server.send(404, "application/json", "{\"error\":\"not found\"}");
  });
  server.begin();
  Serial.println("[http] /kiosk /health /status /kiosk/* on port 80");
  Serial.println("[diag] Serial commands: scan | test | test 0..9 | pulse <ch> <us> <ms>");

  sendHeartbeat();
  lastHeartbeatMs = millis();
}

void loop() {
  server.handleClient();
  handleSerialDiag();
  camLinkLoop();
  kioskSessionLoop();
  dispenserLoop();

  if (WiFi.status() != WL_CONNECTED &&
      millis() - lastWifiRetryMs >= 15000) {
    connectWiFi(15000);
    lastWifiRetryMs = millis();
  }

  pushSessionSyncIfDirty();
  relayCameraFrameIfScanning();

  unsigned long hbInterval = HEARTBEAT_INTERVAL_MS;
  if (kioskPhase != KIOSK_IDLE) {
    hbInterval = HEARTBEAT_ACTIVE_INTERVAL_MS;
  }

  if (millis() - lastHeartbeatMs >= hbInterval) {
    sendHeartbeat();
    lastHeartbeatMs = millis();
  }
}
