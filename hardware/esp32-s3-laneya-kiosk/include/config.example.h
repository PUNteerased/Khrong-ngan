#pragma once

// คัดลอกเป็น config.h แล้วใส่ค่าจริง (config.h ไม่ commit ขึ้น git)

#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// Fixed kiosk location (โรงเรียนอุดมดรุณี — หน้าห้องพยาบาล อาคาร 1)
#define KIOSK_LAT 17.0075
#define KIOSK_LNG 99.8260
#define KIOSK_NAME "LaneYa Kiosk"

// Backend heartbeat (Render) — ต้องตรงกับ KIOSK_HEARTBEAT_SECRET บน server
#define BACKEND_HEARTBEAT_URL "https://khrong-ngan.onrender.com/api/kiosk/heartbeat"
#define KIOSK_HEARTBEAT_SECRET "change-me-kiosk-secret"

#define FIRMWARE_VERSION "1.0.0"
#define HEARTBEAT_INTERVAL_MS 60000
