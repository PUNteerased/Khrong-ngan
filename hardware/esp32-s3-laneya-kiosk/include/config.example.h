#pragma once

// คัดลอกเป็น config.h แล้วใส่ค่าจริง (config.h ไม่ commit ขึ้น git)

#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

#define KIOSK_LAT 17.0075
#define KIOSK_LNG 99.8260
#define KIOSK_NAME "LaneYa Kiosk"

#define BACKEND_HEARTBEAT_URL "https://khrong-ngan.onrender.com/api/kiosk/heartbeat"
#define BACKEND_SESSION_SYNC_URL "https://khrong-ngan.onrender.com/api/kiosk/session-sync"
#define BACKEND_REDEEM_URL "https://khrong-ngan.onrender.com/api/kiosk/redeem-ticket"
#define BACKEND_PREVIEW_URL "https://khrong-ngan.onrender.com/api/kiosk/preview-ticket"
#define KIOSK_HEARTBEAT_SECRET "change-me-kiosk-secret"

#define FIRMWARE_VERSION "1.0.0"
#define HEARTBEAT_INTERVAL_MS 5000  // 5000=รับคำสั่งเร็ว, 60000=ประหยัด traffic

// --- I2C → PCA9685 (มอเตอร์ MG996R 360° ช่อง 0–9) ---
#define I2C_SDA_PIN 9
#define I2C_SCL_PIN 10
#define PCA9685_I2C_ADDR 0x40
#define DISPENSER_SLOT_COUNT 10
#define PCA9685_PWM_FREQ 50

// MG996R 360° — pulse μs (ปรับตามการทดสอบจริง)
#define SERVO_STOP_US 1500
#define SERVO_SPIN_US 1800
#define SERVO_SPIN_US_REV 1200
#define SERVO_SPIN_MS 3000
#define SERVO_MAX_SPIN_MS 3500  // hard cap = SERVO_SPIN_MS + margin
#define SERVO_ALL_GAP_MS 400

// PCA9685 OE — GPIO + 10k pull-up to 3.3V (HIGH=disable PWM, LOW=enable)
// -1 = legacy OE tied to GND (no firmware control)
#define PCA9685_OE_PIN 11

// 0 = reject dispense_all from heartbeat (production), 1 = lab only
#define ALLOW_DISPENSE_ALL 0

// --- IR Barrier — ตรวจยาร่วง ---
#define IR_DROP_LEFT_PIN 4
#define IR_DROP_RIGHT_PIN 5
#define IR_DROP_ACTIVE_LOW 1
#define IR_DROP_USE_PULLUP 1

// --- ESP-NOW → ESP32-CAM (ไม่ต้องต่อสาย TX/RX) ---
// ใส่ MAC 6 ไบต์ของ ESP32-CAM — ดูจาก Serial Monitor ตอน boot กล้อง
// ESP32-CAM — ดู [cam] MAC จาก Serial Monitor ตอน boot กล้อง
#define CAM_ESPNOW_MAC {0x28, 0x05, 0xA5, 0x24, 0x16, 0xAC}
#define CAM_ESPNOW_PING_MS 30000
#define CAM_ESPNOW_TIMEOUT_MS 90000
