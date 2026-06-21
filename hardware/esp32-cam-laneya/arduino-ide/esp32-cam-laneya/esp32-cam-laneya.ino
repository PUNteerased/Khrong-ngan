/*
 * LaneYa — ESP32-CAM-MB + OV3660 (AI-Thinker pin map)
 * QR scan → ESP-NOW "QR:A1-0001-XYZABC" → ESP32-S3 dispense
 *
 * Library QR — scripts/install-qrcode-lib.ps1 (ดู README.md)
 *
 * Pairing:
 * 1. ใส่ CAM MAC ใน S3 → CAM_ESPNOW_MAC (ด้านล่างใน S3 .ino)
 * 2. Upload S3 + CAM — กล้องจับคู่ S3 อัตโนมัติเมื่อได้รับ PING
 *    (หรือใส่ S3_ESPNOW_MAC เองถ้าต้องการ)
 */

// ESP32-S3 MAC: E0:72:A1:F6:F9:A0 (byte แรก = 0xE0 ไม่ใช่ 0xC0)
#define S3_ESPNOW_MAC {0xE0, 0x72, 0xA1, 0xF6, 0xF9, 0xA0}

// ต้อง WiFi เดียวกับ S3 — sync channel ให้ ESP-NOW ถึงกัน (ไม่ใช้ internet)
#define WIFI_SSID "hah"
#define WIFI_PASSWORD "Araina555"

#define MSG_PING "PING"
#define MSG_PONG "PONG"
#define MSG_CAPTURE "CAPTURE"
#define MSG_SCAN "SCAN"
#define MSG_OK "OK"
#define MSG_QR_PREFIX "QR:"
#define MSG_ERR_PREFIX "ERR:"

#define SCAN_DURATION_MS 10000
#define FLASH_LED_PIN 4

#include <WiFi.h>
#include <esp_mac.h>
#include <esp_log.h>
#include <esp_now.h>
#include <ArduinoJson.h>
#include <ESP32QRCodeReader.h>

uint8_t s3PeerMac[6] = S3_ESPNOW_MAC;

static ESP32QRCodeReader qrReader = ESP32QRCodeReader(FRAMESIZE_VGA);

static bool scanning = false;
static unsigned long scanUntilMs = 0;
static bool qrSentThisScan = false;
static unsigned long lastHeartbeatMs = 0;

bool addS3Peer();

static uint8_t espNowChannel() {
  if (WiFi.status() == WL_CONNECTED) {
    return WiFi.channel();
  }
  return 1;
}

static bool connectWifiForEspNow() {
  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.setSleep(false);
  WiFi.disconnect(true);
  delay(100);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[wifi] connecting \"%s\" (sync ESP-NOW channel)...\n", WIFI_SSID);

  const unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] OK IP %s ch=%d RSSI=%d\n",
                  WiFi.localIP().toString().c_str(), WiFi.channel(), WiFi.RSSI());
    return true;
  }
  Serial.println("[wifi] failed — ESP-NOW อาจไม่ถึง S3 (ตรวจ SSID/password/2.4GHz)");
  return false;
}

static bool isPlaceholderMac(const uint8_t* mac) {
  return mac[0] == 0xFF && mac[1] == 0xFF && mac[2] == 0xFF &&
         mac[3] == 0xFF && mac[4] == 0xFF && mac[5] == 0xFF;
}

static bool isZeroMac(const uint8_t* mac) {
  return mac[0] == 0 && mac[1] == 0 && mac[2] == 0 &&
         mac[3] == 0 && mac[4] == 0 && mac[5] == 0;
}

static void printStaMac() {
  uint8_t mac[6] = {};
  esp_err_t err = esp_read_mac(mac, ESP_MAC_WIFI_STA);
  if (err != ESP_OK || isZeroMac(mac)) {
    WiFi.mode(WIFI_STA);
    WiFi.persistent(false);
    delay(100);
    String wifiMac = WiFi.macAddress();
    Serial.printf("[cam] MAC %s\n", wifiMac.c_str());
    if (wifiMac == "00:00:00:00:00:00") {
      Serial.println("[cam] MAC invalid — ลอง reset หรือเปลี่ยนสาย USB / ไฟ 5V");
    }
    return;
  }
  Serial.printf("[cam] MAC %02X:%02X:%02X:%02X:%02X:%02X\n",
                mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

static void printMacLine(const char* label, const uint8_t* mac) {
  Serial.printf("%s %02X:%02X:%02X:%02X:%02X:%02X\n",
                label, mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

static bool ensureS3PeerFromSender(const uint8_t* senderMac) {
  if (!senderMac || isZeroMac(senderMac)) return false;
  if (!isPlaceholderMac(s3PeerMac)) {
    return memcmp(s3PeerMac, senderMac, 6) == 0;
  }
  memcpy(s3PeerMac, senderMac, 6);
  printMacLine("[espnow] auto-paired S3 MAC", s3PeerMac);
  return addS3Peer();
}

static void sendToS3(const char* msg) {
  if (isPlaceholderMac(s3PeerMac)) return;
  esp_now_send(s3PeerMac, reinterpret_cast<const uint8_t*>(msg), strlen(msg));
  Serial.printf("[espnow] >> %s\n", msg);
}

static bool isTicketCode(const char* code) {
  if (!code) return false;
  const size_t len = strlen(code);
  if (len != 14) return false;
  if (code[2] != '-' || code[7] != '-') return false;
  const char row = code[0];
  const char col = code[1];
  if (!((row == 'A' || row == 'B') && col >= '1' && col <= '5')) return false;
  for (int i = 3; i <= 6; i++) {
    if (code[i] < '0' || code[i] > '9') return false;
  }
  for (int i = 8; i < 14; i++) {
    const char c = code[i];
    if (c < 'A' || c > 'Z') return false;
  }
  return true;
}

static void trimPayload(char* s) {
  if (!s) return;
  size_t n = strlen(s);
  while (n > 0 && (s[n - 1] == '\n' || s[n - 1] == '\r' || s[n - 1] == ' ')) {
    s[--n] = '\0';
  }
  size_t start = 0;
  while (s[start] == ' ') start++;
  if (start > 0) memmove(s, s + start, strlen(s + start) + 1);
}

static bool forwardTicketCode(const char* code) {
  char normalized[20];
  strncpy(normalized, code, sizeof(normalized) - 1);
  normalized[sizeof(normalized) - 1] = '\0';
  trimPayload(normalized);
  for (char* p = normalized; *p; p++) {
    if (*p >= 'a' && *p <= 'z') *p = static_cast<char>(*p - 32);
  }
  if (!isTicketCode(normalized)) {
    Serial.printf("[qr] invalid ticket format: %s\n", normalized);
    return false;
  }
  char out[32];
  snprintf(out, sizeof(out), "%s%s", MSG_QR_PREFIX, normalized);
  sendToS3(out);
  return true;
}

static bool handleDecodedQr(const char* payload) {
  if (!payload || !payload[0]) return false;
  char buf[180];
  strncpy(buf, payload, sizeof(buf) - 1);
  buf[sizeof(buf) - 1] = '\0';
  trimPayload(buf);

  if (buf[0] == '{') {
    JsonDocument doc;
    if (deserializeJson(doc, buf)) return false;
    const char* code = doc["code"] | "";
    if (code[0]) return forwardTicketCode(code);
    return false;
  }

  return forwardTicketCode(buf);
}

static void startScan() {
  scanning = true;
  qrSentThisScan = false;
  scanUntilMs = millis() + SCAN_DURATION_MS;
  digitalWrite(FLASH_LED_PIN, HIGH);
  Serial.println("[scan] started (10s)");
}

static void stopScan(const char* errMsg) {
  scanning = false;
  digitalWrite(FLASH_LED_PIN, LOW);
  if (errMsg && !qrSentThisScan) {
    char buf[32];
    snprintf(buf, sizeof(buf), "%s%s", MSG_ERR_PREFIX, errMsg);
    sendToS3(buf);
  }
}

static void handlePayload(const uint8_t* data, int len) {
  if (len <= 0) return;
  char buf[251];
  const int n = len < 250 ? len : 250;
  memcpy(buf, data, n);
  buf[n] = '\0';

  Serial.printf("[espnow] << %s\n", buf);

  if (strcmp(buf, MSG_PING) == 0) {
    sendToS3(MSG_PONG);
  } else if (strcmp(buf, MSG_CAPTURE) == 0) {
    sendToS3(MSG_OK);
  } else if (strcmp(buf, MSG_SCAN) == 0) {
    startScan();
  }
}

#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
void onEspNowRecv(const esp_now_recv_info_t* info, const uint8_t* data, int len) {
  if (info && info->src_addr) {
    ensureS3PeerFromSender(info->src_addr);
  }
  handlePayload(data, len);
}
#else
void onEspNowRecv(const uint8_t* mac, const uint8_t* data, int len) {
  if (mac) {
    ensureS3PeerFromSender(mac);
  }
  handlePayload(data, len);
}
#endif

#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
void onEspNowSent(const wifi_tx_info_t* info, esp_now_send_status_t status) {
  (void)info;
  if (status != ESP_NOW_SEND_SUCCESS) {
    Serial.printf("[espnow] send failed (%d)\n", status);
  }
}
#else
void onEspNowSent(const uint8_t* mac, esp_now_send_status_t status) {
  (void)mac;
  if (status != ESP_NOW_SEND_SUCCESS) {
    Serial.printf("[espnow] send failed (%d)\n", status);
  }
}
#endif

bool addS3Peer() {
  if (isPlaceholderMac(s3PeerMac)) {
    return false;
  }
  if (esp_now_is_peer_exist(s3PeerMac)) {
    esp_now_del_peer(s3PeerMac);
  }

  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, s3PeerMac, 6);
  peer.channel = espNowChannel();
  peer.encrypt = false;
  peer.ifidx = WIFI_IF_STA;
  if (esp_now_add_peer(&peer) != ESP_OK) {
    return false;
  }
  Serial.printf("[espnow] peer S3 ch=%d ", peer.channel);
  printMacLine("", s3PeerMac);
  return true;
}

void setup() {
  // ลด log จาก ESP-IDF ตอน boot — กัน Serial Monitor / IDE ค้างหลังกด RST
  esp_log_level_set("*", ESP_LOG_ERROR);

  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println("[boot] start — ถ้าไม่เห็นบรรทัดนี้: ปล่อย IO0 แล้วกด RST");

  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);

  Serial.println("[boot] LaneYa ESP32-CAM-MB OV3660 (QR + ESP-NOW)");
  connectWifiForEspNow();
  printStaMac();

  const QRCodeReaderSetupErr qrSetup = qrReader.setup();
  if (qrSetup == SETUP_OK) {
    qrReader.beginOnCore(1);
    Serial.println("[qr] ESP32QRCodeReader ready");
  } else if (qrSetup == SETUP_NO_PSRAM_ERROR) {
    Serial.println("[qr] PSRAM not found — ใช้บอร์ด AI Thinker ESP32-CAM");
  } else {
    Serial.println("[qr] camera init failed — ถอด USB แล้ว reset");
  }

  if (esp_now_init() != ESP_OK) {
    Serial.println("[espnow] init failed");
    return;
  }

  esp_now_register_recv_cb(onEspNowRecv);
  esp_now_register_send_cb(onEspNowSent);
  if (addS3Peer()) {
    Serial.println("[espnow] S3 peer ready (fixed MAC)");
  } else {
    Serial.println("[espnow] รอ PING จาก S3 เพื่อจับคู่อัตโนมัติ");
  }
  Serial.println("[boot] done — heartbeat ทุก 5s");
}

void loop() {
  if (!isPlaceholderMac(s3PeerMac) && !esp_now_is_peer_exist(s3PeerMac)) {
    addS3Peer();
  }

  if (!scanning) {
    const unsigned long now = millis();
    if (now - lastHeartbeatMs >= 5000) {
      lastHeartbeatMs = now;
      if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("[cam] alive ch=%d\n", WiFi.channel());
      } else {
        Serial.println("[cam] alive (wifi down)");
      }
    }
    delay(10);
    return;
  }

  if (millis() > scanUntilMs) {
    stopScan("timeout");
    delay(10);
    return;
  }

  struct QRCodeData qrCodeData;
  if (qrReader.receiveQrCode(&qrCodeData, 100)) {
    if (qrCodeData.valid && !qrSentThisScan) {
      Serial.println("[qr] decoded");
      if (handleDecodedQr(reinterpret_cast<const char*>(qrCodeData.payload))) {
        qrSentThisScan = true;
        stopScan(nullptr);
      }
    }
  }
}
