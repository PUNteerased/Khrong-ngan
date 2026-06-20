/*
 * LaneYa — ESP32-CAM + OV3630 (AI-Thinker pin map)
 * QR scan → ESP-NOW "QR:A1-0001-XYZABC" → ESP32-S3 dispense
 *
 * Library (Arduino IDE): ESP32 QRCode Reader by alvarowolfx
 *   Sketch → Include Library → Manage Libraries → "ESP32 QRCode Reader"
 *
 * Pairing:
 * 1. Upload → Serial shows CAM MAC
 * 2. Put CAM MAC in S3 .ino → CAM_ESPNOW_MAC
 * 3. Upload S3 → Serial shows S3 MAC
 * 4. Set S3_ESPNOW_MAC below → re-upload CAM
 */

#define S3_ESPNOW_MAC {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}

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
#include <esp_now.h>
#include <esp_camera.h>
#include <ArduinoJson.h>

#if __has_include(<ESP32QRCodeReader.h>)
#include <ESP32QRCodeReader.h>
#define HAS_QR_READER 1
#endif

uint8_t s3PeerMac[6] = S3_ESPNOW_MAC;

#ifdef HAS_QR_READER
static ESP32QRCodeReader qrReader = ESP32QRCodeReader();
#endif

static bool scanning = false;
static unsigned long scanUntilMs = 0;
static bool qrSentThisScan = false;

static bool isPlaceholderMac(const uint8_t* mac) {
  return mac[0] == 0xFF && mac[1] == 0xFF && mac[2] == 0xFF &&
         mac[3] == 0xFF && mac[4] == 0xFF && mac[5] == 0xFF;
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
  (void)info;
  handlePayload(data, len);
}
#else
void onEspNowRecv(const uint8_t* mac, const uint8_t* data, int len) {
  (void)mac;
  handlePayload(data, len);
}
#endif

bool addS3Peer() {
  if (isPlaceholderMac(s3PeerMac)) {
    Serial.println("[espnow] ตั้ง S3_ESPNOW_MAC จาก MAC บน Serial ของ ESP32-S3");
    return false;
  }
  if (esp_now_is_peer_exist(s3PeerMac)) return true;

  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, s3PeerMac, 6);
  peer.channel = 0;
  peer.encrypt = false;
  peer.ifidx = WIFI_IF_STA;
  return esp_now_add_peer(&peer) == ESP_OK;
}

static bool initCamera() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  // AI-Thinker ESP32-CAM — OV3630 / OV2640 / OV3660 ใช้ pin map เดียวกัน
  config.pin_d0 = 5;
  config.pin_d1 = 18;
  config.pin_d2 = 19;
  config.pin_d3 = 21;
  config.pin_d4 = 36;
  config.pin_d5 = 39;
  config.pin_d6 = 34;
  config.pin_d7 = 35;
  config.pin_xclk = 0;
  config.pin_pclk = 22;
  config.pin_vsync = 25;
  config.pin_href = 23;
  config.pin_sccb_sda = 26;
  config.pin_sccb_scl = 27;
  config.pin_pwdn = 32;
  config.pin_reset = -1;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_GRAYSCALE;
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = 12;
  config.fb_count = 2;
  config.grab_mode = CAMERA_GRAB_LATEST;

  const esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[cam] OV3630 init failed 0x%x\n", err);
    return false;
  }

  sensor_t* s = esp_camera_sensor_get();
  if (s) {
    s->set_framesize(s, FRAMESIZE_VGA);
    s->set_vflip(s, 0);
    s->set_hmirror(s, 0);
  }

  Serial.println("[cam] OV3630 init ok");
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  Serial.println("[boot] LaneYa ESP32-CAM OV3630 (QR + ESP-NOW)");
  Serial.printf("[cam] MAC %s\n", WiFi.macAddress().c_str());

  if (!initCamera()) {
    Serial.println("[cam] camera required for QR scan");
  }

#ifdef HAS_QR_READER
  qrReader.setup();
  Serial.println("[qr] ESP32QRCodeReader ready");
#else
  Serial.println("[qr] install library: ESP32 QRCode Reader (alvarowolfx)");
#endif

  if (esp_now_init() != ESP_OK) {
    Serial.println("[espnow] init failed");
    return;
  }

  esp_now_register_recv_cb(onEspNowRecv);
  addS3Peer();
}

void loop() {
  if (!isPlaceholderMac(s3PeerMac) && !esp_now_is_peer_exist(s3PeerMac)) {
    addS3Peer();
  }

  if (!scanning) {
    delay(10);
    return;
  }

  if (millis() > scanUntilMs) {
    stopScan("timeout");
    delay(10);
    return;
  }

#ifdef HAS_QR_READER
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
#else
  delay(50);
#endif
}
