# ESP32-CAM — กล้องตู้จ่ายยา LaneYa

บอร์ดกล้อง **ESP32-CAM + OV3630** สื่อสารกับ ESP32-S3 หลักผ่าน **ESP-NOW** (ไม่ต้องต่อสาย TX/RX)

## การต่อ

| สาย | หมายเหตุ |
|-----|----------|
| 5V, GND | ไฟเลี้ยงกล้อง (วางห่างจาก S3 ได้) |
| ~~TX/RX~~ | **ไม่ใช้** — ใช้ ESP-NOW แทน |

## Library (Arduino IDE)

ติดตั้ง **ESP32 QRCode Reader** (alvarowolfx) จาก Library Manager

## QR format

มือถือแสดง QR เป็นข้อความอย่างเดียว เช่น `A1-0001-XYZABC`  
CAM สแกนแล้วส่ง ESP-NOW → S3: `QR:A1-0001-XYZABC`

## ตั้งค่า MAC

1. Upload `.ino` → Serial Monitor **115200**
2. จด `[cam] MAC xx:xx:xx:xx:xx:xx` → ใส่ใน S3 `.ino` → `CAM_ESPNOW_MAC`
3. จด MAC จาก S3 → แก้ `S3_ESPNOW_MAC` ใน `.ino` → upload กล้องอีกครั้ง

## Arduino IDE

1. เปิด `arduino-ide/esp32-cam-laneya/esp32-cam-laneya.ino`
2. เลือกบอร์ด **AI Thinker ESP32-CAM**
3. Upload (อาจต้องใช้ USB-TTL + GPIO 0)

เมื่อ S3 ส่ง `SCAN` กล้องสแกน QR 10 วินาที — ดู `[espnow] >> QR:...` บน Serial ของ CAM

แผนผังทั้งระบบ: [`../esp32-s3-laneya-kiosk/WIRING.md`](../esp32-s3-laneya-kiosk/WIRING.md)
