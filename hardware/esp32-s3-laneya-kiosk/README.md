# ESP32-S3 — ตู้จ่ายยา LaneYa

Firmware สำหรับบอร์ด ESP32-S3 ที่ตู้จ่ายยา

## ไฟล์ในโฟลเดอร์นี้

| ไฟล์/โฟลเดอร์ | ใช้เมื่อ |
|---------------|----------|
| `src/main.cpp` + `platformio.ini` | อัปโหลดด้วย **PlatformIO** |
| `arduino-ide/.../*.ino` | อัปโหลดด้วย **Arduino IDE** (ไม่ต้องติดตั้ง library) |
| `include/config.example.h` | ตัวอย่าง config → คัดลอกเป็น `config.h` |
| `scripts/upload.ps1` | อัปโหลดบน Windows (ไม่ต้องมี `pio` ใน PATH) |

## อัปโหลด (Windows — แก้ error `pio` not recognized)

```powershell
cd hardware\esp32-s3-laneya-kiosk
.\scripts\upload.ps1
```

ถ้ายังไม่มี PlatformIO:

```powershell
pip install platformio
```

หรือติดตั้ง extension **PlatformIO IDE** ใน Cursor แล้วเปิดโฟลเดอร์นี้

## Arduino IDE

1. ติดตั้ง [ESP32 board support](https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html)
2. เปิด `arduino-ide/esp32-s3-laneya-kiosk/esp32-s3-laneya-kiosk.ino`
3. เลือกบอร์ด **ESP32S3 Dev Module**
4. แก้ WiFi / secret ด้านบนไฟล์ → Upload

## API บนบอร์ด (HTTP port 80)

| Path | คำตอบ |
|------|--------|
| `GET /health` | `{"ok":true,"device":"esp32-s3"}` |
| `GET /status` | lat, lng, online, name, rssi |

ทุก 60 วินาที → `POST` ไป `BACKEND_HEARTBEAT_URL` พร้อม header `X-Kiosk-Secret`

## Backend (Render)

```env
KIOSK_LAT=17.0075
KIOSK_LNG=99.8260
KIOSK_NAME=LaneYa Kiosk
KIOSK_HEARTBEAT_SECRET=<ตรงกับ config.h หรือ .ino>
CABINET_HEALTH_URL=http://<IP-ESP32>/health
```

หน้า Contact ใช้ `GET /api/kiosk/status` แสดง Google Map + Online/Offline
