# ESP32-S3 — ตู้จ่ายยา LaneYa (Firmware เต็ม)

บอร์ดหลัก **ESP32-S3 N16R8** — WiFi, heartbeat, I2C (PCA9685), IR ตรวจยาร่วง, ESP-NOW ไป ESP32-CAM

**การต่อสาย:** [`WIRING.md`](WIRING.md)

## โมดูล

| โมดูล | ไฟล์ | ฮาร์ดแวร์ |
|--------|------|-----------|
| WiFi | `wifi_manager.cpp` | 2.4 GHz |
| HTTP | `kiosk_http.cpp` | `/health`, `/status`, `/dispense` |
| Heartbeat | `heartbeat.cpp` | → Render + รับคำสั่ง Admin |
| จ่ายยา | `dispenser.cpp` | PCA9685, MG90S x10 ช่อง 0–9 |
| ตรวจยาร่วง | `drop_sensor.cpp` | IR GPIO 4, 5 |
| กล้อง | `cam_link.cpp` | ESP-NOW → ESP32-CAM |

เทส WiFi อย่างเดียว: [`../esp32-s3-connext/`](../esp32-s3-connext/)  
Firmware กล้อง: [`../esp32-cam-laneya/`](../esp32-cam-laneya/)

## อัปโหลด

### Arduino IDE

1. ติดตั้ง libraries: **ArduinoJson**, **Adafruit PWM Servo Driver**, **Adafruit BusIO**
2. เปิด `arduino-ide/esp32-s3-laneya-kiosk/esp32-s3-laneya-kiosk.ino`
3. แก้ WiFi + `KIOSK_HEARTBEAT_SECRET`
4. Upload → **Serial Monitor 115200**

### PlatformIO

```powershell
cd hardware\esp32-s3-laneya-kiosk
copy include\config.example.h include\config.h
.\scripts\upload.ps1
.\scripts\monitor.ps1
```

## ทดสอบ Servo จากหน้า Admin + ดู Serial Monitor

1. Deploy backend บน Render (มี `/api/admin/kiosk/servo-test`)
2. ตั้ง `KIOSK_HEARTBEAT_SECRET` ให้ตรงกัน (Render + firmware)
3. Upload firmware ใหม่ (`.ino` หรือ PlatformIO)
4. เปิด **Tools → Serial Monitor** ที่ **115200**
5. Login Admin → แท็บ **ฮาร์ดแวร์** → กด **ช่อง 0–9**
6. รอ heartbeat รอบถัดไป (default 60s — เทสเร็ว: ตั้ง `HEARTBEAT_INTERVAL_MS 15000`)

### ข้อความที่ควรเห็นใน Serial Monitor

```
[heartbeat] HTTP 200
[web-cmd] received dispense slot=3 id=...
[web-cmd] spinning PCA9685 channel 3
[dispenser] spin slot 3 (MG90S 360)
[web-cmd] done ok — ack queued id=...
[web-cmd] ack sent id=... ok=true
```

ถ้าเห็นแค่ `[heartbeat] HTTP 200` โดยไม่มี `[web-cmd]` = firmware เก่า หรือ backend ยังไม่ deploy API คำสั่ง

### ทดสอบใน LAN (ไม่ผ่าน Admin)

```http
POST http://<IP-ESP32>/dispense
Header: X-Kiosk-Secret: <secret>
Body: {"slot": 0}
```

Serial จะแสดง `[web-cmd] LAN POST /dispense slot=0`

## พิน GPIO (สรุป)

| GPIO | ใช้กับ |
|------|--------|
| 9 | I2C SDA → PCA9685 |
| 10 | I2C SCL → PCA9685 |
| 4 | IR ตรวจยาร่วง ซ้าย |
| 5 | IR ตรวจยาร่วง ขวา |

กล้อง ESP32-CAM: **ESP-NOW** — ตั้ง `CAM_ESPNOW_MAC` ใน `config.h`
