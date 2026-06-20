/*
 * LaneYa — ESP32-CAM + OV3660
 * สื่อสารกับ ESP32-S3 ผ่าน ESP-NOW (ไม่ต้องต่อสาย TX/RX)
 *
 * 1. Upload ครั้งแรก → Serial Monitor แสดง MAC ของกล้อง
 * 2. ใส่ MAC กล้องใน S3 config.h → CAM_ESPNOW_MAC
 * 3. Upload S3 → Serial แสดง MAC ของ S3
 * 4. ใส่ MAC S3 ด้านล่าง → S3_ESPNOW_MAC แล้ว upload กล้องอีกครั้ง
 *
 * Board: AI Thinker ESP32-CAM (หรือรุ่น OV3660)
 */

#define S3_ESPNOW_MAC {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}

#define MSG_PING "PING"
#define MSG_PONG "PONG"
#define MSG_CAPTURE "CAPTURE"
#define MSG_OK "OK"

#include <WiFi.h>
#include <esp_now.h>

uint8_t s3PeerMac[6] = S3_ESPNOW_MAC;

static bool isPlaceholderMac(const uint8_t* mac) {
  return mac[0] == 0xFF && mac[1] == 0xFF && mac[2] == 0xFF &&
         mac[3] == 0xFF && mac[4] == 0xFF && mac[5] == 0xFF;
}

static void sendToS3(const char* msg) {
  if (isPlaceholderMac(s3PeerMac)) return;
  esp_now_send(s3PeerMac, reinterpret_cast<const uint8_t*>(msg), strlen(msg));
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
    // Phase 2: ถ่ายรูป + อัปโหลด WiFi เอง แล้วส่ง URL กลับ
    sendToS3(MSG_OK);
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

void setup() {
  Serial.begin(115200);
  delay(500);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  Serial.println("[boot] LaneYa ESP32-CAM (ESP-NOW)");
  Serial.printf("[cam] MAC %s\n", WiFi.macAddress().c_str());

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
  delay(10);
}
