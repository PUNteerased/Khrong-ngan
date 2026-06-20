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
#define WIFI_SSID "hah"
#define WIFI_PASSWORD "Araina555"

#define KIOSK_LAT 17.0075
#define KIOSK_LNG 99.8260
#define KIOSK_NAME "LaneYa Kiosk"

#define BACKEND_HEARTBEAT_URL "https://khrong-ngan.onrender.com/api/kiosk/heartbeat"
#define KIOSK_HEARTBEAT_SECRET "ilovevijai"

#define FIRMWARE_VERSION "1.0.0-kiosk"
// รับคำสั่ง Admin เร็วขึ้น — ESP32 ดึง command ทุกครั้งที่ POST heartbeat นี้
// production อาจใช้ 15000–30000 ถ้าไม่อยากยิง Render บ่อย
#define HEARTBEAT_INTERVAL_MS 5000

#define I2C_SDA_PIN 9
#define I2C_SCL_PIN 10
#define PCA9685_I2C_ADDR 0x40
#define DISPENSER_SLOT_COUNT 10
#define PCA9685_PWM_FREQ 50
// MG996R 360° — ค่านี้ใช้กับ MG996R เท่านั้น
// MG90S 360° มักไม่หยุดที่ 1500 (หมุน idle) → ใช้ MG996R ในตู้จริง หรือปรับ STOP ด้วย pulse 0 1480 0
#define SERVO_STOP_US 1500
#define SERVO_SPIN_US 2000
#define SERVO_SPIN_US_REV 1200
#define SERVO_SPIN_MS 3000

// 1 = หมุนช่อง 0 ตอน boot | 0 = ปิด (แนะนำเมื่อใช้งานจริง)
#define BOOT_SERVO_TEST 0
// ================================================

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <ArduinoJson.h>
#include <Adafruit_PWMServoDriver.h>

WebServer server(80);
Adafruit_PWMServoDriver pwm(PCA9685_I2C_ADDR);

unsigned long lastHeartbeatMs = 0;
unsigned long lastWifiRetryMs = 0;
bool pwmReady = false;

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
  writeServoPulse(slotIndex, SERVO_STOP_US);
}

void runBootServoTest() {
  Serial.println("[diag] === BOOT SERVO TEST ch0 ===");
  Serial.println("[diag] ต้องมี: ไฟ 5V ที่ V+ ขั้วนอต PCA9685 + GND ร่วม + servo ช่อง 0");
  Serial.println("[diag] ถ้าไม่หมุน → มักเป็นไฟ servo หรือ OE ไม่ต่อ GND");
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
  for (uint8_t ch = 0; ch < DISPENSER_SLOT_COUNT; ch++) {
    writeServoPulse(ch, SERVO_STOP_US);
  }
  Serial.println("[dispenser] PCA9685 ready (channels 0-9)");
  Serial.println("[dispenser] ⚠ servo ต้องมีไฟ 5V ที่ขั้ว V+ ของ PCA9685 (ไม่ใช่แค่ 3.3V logic)");
#if BOOT_SERVO_TEST
  runBootServoTest();
#endif
}

bool dispenserDispenseSlot(uint8_t slotIndex) {
  if (!pwmReady) {
    Serial.println("[dispenser] ERROR: PCA9685 not ready — ไม่หมุน servo");
    return false;
  }
  if (slotIndex >= DISPENSER_SLOT_COUNT) return false;
  Serial.printf("[web-cmd] spinning PCA9685 channel %u\n", slotIndex);
  Serial.printf("[dispenser] spin slot %u (MG90S 360)\n", slotIndex);

  writeServoPulse(slotIndex, SERVO_SPIN_US);
  delay(SERVO_SPIN_MS);
  writeServoPulse(slotIndex, SERVO_STOP_US);
  return true;
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

  if (!id[0] || strcmp(action, "dispense") != 0 || slot < 0 || slot > 9) {
    Serial.println("[web-cmd] ignored invalid command");
    return;
  }

  Serial.printf("[web-cmd] received dispense slot=%d id=%s\n", slot, id);
  const bool ok = dispenserDispenseSlot(static_cast<uint8_t>(slot));
  queueAck(id, ok, ok ? nullptr : "dispense failed");
}

void handleHealth() {
  server.send(200, "application/json", "{\"ok\":true,\"device\":\"esp32-s3\"}");
}

void handleStatus() {
  JsonDocument doc;
  doc["online"] = WiFi.status() == WL_CONNECTED;
  doc["lat"] = KIOSK_LAT;
  doc["lng"] = KIOSK_LNG;
  doc["name"] = KIOSK_NAME;
  doc["device"] = "esp32-s3";
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["rssi"] = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0;
  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

bool authorizeKioskRequest() {
  if (strlen(KIOSK_HEARTBEAT_SECRET) == 0) return false;
  return server.header("X-Kiosk-Secret") == KIOSK_HEARTBEAT_SECRET;
}

void handleDispense() {
  if (!authorizeKioskRequest()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\"}");
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
  Serial.begin(115200);
  delay(500);
  Serial.println("[boot] LaneYa ESP32-S3 Kiosk (web-cmd + PCA9685)");

  connectWiFi();
  dispenserSetup();

  server.on("/health", HTTP_GET, handleHealth);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/dispense", HTTP_POST, handleDispense);
  server.onNotFound([]() {
    server.send(404, "application/json", "{\"error\":\"not found\"}");
  });
  server.begin();
  Serial.println("[http] /health /status /dispense on port 80");
  Serial.println("[diag] Serial commands: scan | test | test 0..9 | pulse <ch> <us> <ms>");

  sendHeartbeat();
  lastHeartbeatMs = millis();
}

void loop() {
  server.handleClient();
  handleSerialDiag();

  if (WiFi.status() != WL_CONNECTED &&
      millis() - lastWifiRetryMs >= 15000) {
    connectWiFi(15000);
    lastWifiRetryMs = millis();
  }

  if (millis() - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
    sendHeartbeat();
    lastHeartbeatMs = millis();
  }
}
