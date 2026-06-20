# ESP32-CAM — กล้องตู้จ่ายยา LaneYa

บอร์ดกล้อง **ESP32-CAM + OV3660** สื่อสารกับ ESP32-S3 หลักผ่าน **ESP-NOW** (ไม่ต้องต่อสาย TX/RX)

## การต่อ

| สาย | หมายเหตุ |
|-----|----------|
| 5V, GND | ไฟเลี้ยงกล้อง (วางห่างจาก S3 ได้) |
| ~~TX/RX~~ | **ไม่ใช้** — ใช้ ESP-NOW แทน |

## ตั้งค่า MAC

1. Upload `.ino` → Serial Monitor **115200**
2. จด `[cam] MAC xx:xx:xx:xx:xx:xx` → ใส่ใน S3 `CAM_ESPNOW_MAC`
3. จด MAC จาก S3 → แก้ `S3_ESPNOW_MAC` ใน `.ino` → upload กล้องอีกครั้ง

## Arduino IDE

1. เปิด `arduino-ide/esp32-cam-laneya/esp32-cam-laneya.ino`
2. เลือกบอร์ด ESP32-CAM ตามรุ่น
3. Upload (อาจต้องใช้ USB-TTL + GPIO 0)

เมื่อ S3 ส่ง `PING` กล้องตอบ `PONG` — ดู `[cam] ESP-NOW << PONG` บน Serial ของ S3

แผนผังทั้งระบบ: [`../esp32-s3-laneya-kiosk/WIRING.md`](../esp32-s3-laneya-kiosk/WIRING.md)
