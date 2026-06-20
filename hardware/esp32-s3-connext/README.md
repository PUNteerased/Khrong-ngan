# ESP32-S3 Connext

Firmware **เทสเชื่อมต่ออย่างเดียว** — WiFi, HTTP บนบอร์ด, heartbeat ไป backend

ใช้ตอนเริ่มต้นหรือ debug ก่อนใช้ firmware เต็มใน [`../esp32-s3-laneya-kiosk/`](../esp32-s3-laneya-kiosk/)

## Arduino IDE

1. เปิด `arduino-ide/esp32-s3-connext/esp32-s3-connext.ino`
2. แก้ `WIFI_SSID`, `WIFI_PASSWORD`, `KIOSK_HEARTBEAT_SECRET`
3. Board: **ESP32S3 Dev Module**, Flash **16MB**, PSRAM **OPI PSRAM**, Port **COM…**
4. Upload → Serial Monitor **115200**

## ทดสอบ

| ที่ | URL / ผล |
|-----|----------|
| บอร์ด | `http://<IP>/health`, `http://<IP>/status` |
| Serial | `[heartbeat] HTTP 200` |
| เว็บ | หน้า Contact — สถานะตู้ออนไลน์ |
