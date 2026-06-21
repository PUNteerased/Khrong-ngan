#include "cam_link.h"

#include <WiFi.h>
#include <esp_now.h>
#include <ArduinoJson.h>

#include "cam_espnow_protocol.h"
#include "kiosk_session.h"

#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#endif

#ifndef CAM_ESPNOW_MAC
#define CAM_ESPNOW_MAC {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}
#endif

static uint8_t camPeerMac[6] = CAM_ESPNOW_MAC;
static bool camOnline = false;
static bool camPeerReady = false;
static unsigned long lastCamRxMs = 0;
static unsigned long lastCamPingMs = 0;

static bool isPlaceholderMac(const uint8_t* mac) {
  return mac[0] == 0xFF && mac[1] == 0xFF && mac[2] == 0xFF &&
         mac[3] == 0xFF && mac[4] == 0xFF && mac[5] == 0xFF;
}

void camLinkOnQrPayload(const char* payload) {
  if (!payload || !payload[0]) return;
  if (payload[0] == '{') {
    JsonDocument doc;
    if (!deserializeJson(doc, payload)) {
      const char* code = doc["code"] | "";
      const char* signature = doc["signature"] | doc["sig"] | "";
      if (code[0]) {
        kioskSessionOnQrCode(code, signature[0] ? signature : nullptr);
      }
    }
  } else {
    kioskSessionOnQrCode(payload, nullptr);
  }
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
    camLinkOnQrPayload(buf + strlen(CAM_MSG_QR_PREFIX));
  }
  Serial.printf("[cam] ESP-NOW << %s\n", buf);
}

#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
static void onEspNowRecv(const esp_now_recv_info_t* info, const uint8_t* data, int len) {
  (void)info;
  handleCamPayload(data, len);
}

static void onEspNowSent(const wifi_tx_info_t* info, esp_now_send_status_t status) {
  (void)info;
  if (status != ESP_NOW_SEND_SUCCESS) {
    Serial.printf("[cam] ESP-NOW send failed (%d)\n", status);
  }
}
#else
static void onEspNowRecv(const uint8_t* mac, const uint8_t* data, int len) {
  (void)mac;
  handleCamPayload(data, len);
}

static void onEspNowSent(const uint8_t* mac, esp_now_send_status_t status) {
  (void)mac;
  if (status != ESP_NOW_SEND_SUCCESS) {
    Serial.printf("[cam] ESP-NOW send failed (%d)\n", status);
  }
}
#endif

static bool addCamPeer() {
  if (isPlaceholderMac(camPeerMac)) {
    Serial.println("[cam] ตั้ง CAM_ESPNOW_MAC ใน config.h (ดู MAC จาก Serial ของ ESP32-CAM)");
    return false;
  }

  if (esp_now_is_peer_exist(camPeerMac)) {
    camPeerReady = true;
    return true;
  }

  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, camPeerMac, 6);
  peer.channel = WiFi.channel();
  peer.encrypt = false;
  peer.ifidx = WIFI_IF_STA;

  if (esp_now_add_peer(&peer) != ESP_OK) {
    Serial.println("[cam] esp_now_add_peer failed");
    return false;
  }

  camPeerReady = true;
  Serial.printf("[cam] peer CAM %02X:%02X:%02X:%02X:%02X:%02X ch=%d\n",
                camPeerMac[0], camPeerMac[1], camPeerMac[2],
                camPeerMac[3], camPeerMac[4], camPeerMac[5], peer.channel);
  return true;
}

static void sendCamMessage(const char* msg) {
  if (!camPeerReady) return;
  esp_now_send(camPeerMac, reinterpret_cast<const uint8_t*>(msg), strlen(msg));
  Serial.printf("[cam] ESP-NOW >> %s\n", msg);
}

void camLinkSetup() {
  Serial.printf("[cam] S3 MAC %s\n", WiFi.macAddress().c_str());

  if (esp_now_init() != ESP_OK) {
    Serial.println("[cam] esp_now_init failed");
    return;
  }

  esp_now_register_recv_cb(onEspNowRecv);
  esp_now_register_send_cb(onEspNowSent);

  if (addCamPeer()) {
    sendCamMessage(CAM_MSG_PING);
    lastCamPingMs = millis();
  }
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

bool camLinkOnline() { return camOnline; }

void camLinkRequestCapture() {
  sendCamMessage(CAM_MSG_CAPTURE);
}

void camLinkRequestScan() {
  sendCamMessage(CAM_MSG_SCAN);
}

void camLinkRequestScanStop() {
  sendCamMessage(CAM_MSG_SCAN_STOP);
}
