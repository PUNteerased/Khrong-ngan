# LaneYa Hardware

โฟลเดอร์ firmware ของอุปกรณ์ที่เชื่อมกับเว็บ LaneYa

## โฟลเดอร์หลัก

| โฟลเดอร์ | ใช้เมื่อ | รายละเอียด |
|----------|----------|------------|
| [`esp32-s3-connext/`](esp32-s3-connext/) | **เทสเชื่อมต่อครั้งแรก** | Arduino IDE ไฟล์เดียว — WiFi + heartbeat |
| [`esp32-s3-laneya-kiosk/`](esp32-s3-laneya-kiosk/) | **โปรเจกต์จริง** | Arduino IDE `.ino` หรือ PlatformIO แยกโมดูล |

## อุปกรณ์ในโปรเจกต์

| อุปกรณ์ | บอร์ด | โฟลเดอร์ |
|---------|-------|----------|
| บอร์ดหลัก | ESP32-S3 N16R8 | [`esp32-s3-laneya-kiosk/`](esp32-s3-laneya-kiosk/) |
| เทส WiFi | ESP32-S3 | [`esp32-s3-connext/`](esp32-s3-connext/) |
| มอเตอร์ช่องยา | PCA9685 + MG90S 360° x10 | ใน kiosk — I2C GPIO 9/10 |
| ตรวจยาร่วง | IR Barrier x2 | GPIO 4, 5 |
| กล้อง | ESP32-CAM + OV3660 | [`esp32-cam-laneya/`](esp32-cam-laneya/) — ESP-NOW |

**แผนผังสาย:** [`esp32-s3-laneya-kiosk/WIRING.md`](esp32-s3-laneya-kiosk/WIRING.md)

---

## เริ่มเร็ว — Connext (Arduino IDE)

1. เปิด `esp32-s3-connext/arduino-ide/esp32-s3-connext/esp32-s3-connext.ino`
2. แก้ WiFi + `KIOSK_HEARTBEAT_SECRET`
3. Board: **ESP32S3 Dev Module**, Flash **16MB**, PSRAM **OPI PSRAM**
4. Upload → Serial Monitor **115200**

รายละเอียด: [`esp32-s3-connext/README.md`](esp32-s3-connext/README.md)

---

## โปรเจกต์เต็ม — LaneYa Kiosk (PlatformIO)

```powershell
cd hardware\esp32-s3-laneya-kiosk
copy include\config.example.h include\config.h
# แก้ config.h
.\scripts\upload.ps1
```

รายละเอียด: [`esp32-s3-laneya-kiosk/README.md`](esp32-s3-laneya-kiosk/README.md)

---

## ตั้งค่า Backend (Render)

```env
KIOSK_HEARTBEAT_SECRET=<ตรงกับบอร์ด>
KIOSK_LAT=17.0075
KIOSK_LNG=99.8260
KIOSK_NAME=LaneYa Kiosk
```

หน้า Contact ใช้ `GET /api/kiosk/status` แสดงสถานะออนไลน์
