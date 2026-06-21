# ESP32-S3 — ตู้จ่ายยา LaneYa (Firmware เต็ม)

บอร์ดหลัก **ESP32-S3 N16R8** — WiFi, heartbeat, I2C (PCA9685), IR ตรวจยาร่วง, ESP-NOW ไป ESP32-CAM

**การต่อสาย:** [`WIRING.md`](WIRING.md)

## โมดูล

| โมดูล | ไฟล์ | ฮาร์ดแวร์ |
|--------|------|-----------|
| WiFi | `wifi_manager.cpp` | 2.4 GHz |
| HTTP | `kiosk_http.cpp` | `/health`, `/status`, `/kiosk/*`, `/dispense` |
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

### API สำหรับแท็บเล็ต Kiosk Display

แท็บเล็ต poll ผ่าน WiFi LAN (CORS เปิดแล้ว):

| Method | Path | หน้าที่ |
|--------|------|---------|
| GET | `/kiosk/session` | สถานะ phase, countdown, preview |
| POST | `/kiosk/scan/start` | เปิดกล้อง CAM สแกน 45 วิ |
| POST | `/kiosk/scan/cancel` | ยกเลิก + ปิด flash |
| POST | `/kiosk/pickup/confirm` | redeem backend + หมุนมอเตอร์ |

Flow: QR จาก CAM → `preview-ticket` (ยังไม่จ่าย) → ผู้ป่วยยืนยันบนแท็บเล็ต → confirm → dispense

ดู frontend: [`../../frontend/KIOSK.md`](../../frontend/KIOSK.md)

## Troubleshooting — แสกน QR ไม่ติด

**แท็บเล็ตต้องเปิด UI ผ่าน HTTP บน LAN** — ไม่ใช่ `https://...vercel.app` (mixed content บล็อก fetch ไป ESP32)

ลำดับเช็ค:

1. แท็บเล็ต + S3 + CAM อยู่ WiFi เดียวกัน
2. `GET http://<S3-IP>/status` → `"camOnline": true`
3. `POST /kiosk/scan/start` — ถ้า CAM offline ได้ **503** `{"error":"cam offline"}`
4. Serial S3 หลังกดสแกน: `[cam] ESP-NOW >> SCAN (ok)` + `[kiosk] scan started`
5. Serial CAM: `[scan] started (45s)` + `[espnow] >> OK`
6. ถือ QR ใกล้กล้อง → CAM: `[qr] decoded` → S3: `[pickup] preview ok`
7. หมดเวลา 45s → CAM ส่ง `ERR:timeout` → S3 phase `error`, `session.error` = `scan timeout`

| HTTP preview | `session.error` บนแท็บเล็ต |
|--------------|---------------------------|
| 401 | `unauthorized` — `KIOSK_HEARTBEAT_SECRET` ไม่ตรง |
| 404 | `ticket not found` |
| 410 | `ticket expired` |

## พิน GPIO (สรุป)

| GPIO | ใช้กับ |
|------|--------|
| 9 | I2C SDA → PCA9685 |
| 10 | I2C SCL → PCA9685 |
| 11 | PCA9685 OE (+ 10k pull-up → 3.3V) |
| 4 | IR ตรวจยาร่วง ซ้าย |
| 5 | IR ตรวจยาร่วง ขวา |

กล้อง ESP32-CAM: **ESP-NOW** — ตั้ง `CAM_ESPNOW_MAC` ใน `config.h`

## Servo ไม่หมุน แต่ Admin/Serial บอกสำเร็จ

ซอฟต์แวร์ทำงานแล้ว — ปัญหามักเป็น **ไฟเลี้ยงมอเตอร์** ไม่ใช่ ESP32

### เช็คตามลำดับ

1. **ไฟ 5V ที่ขั้ว V+ ของ PCA9685** (ขั้วนอตด้าน side) — 3.3V จาก ESP32 ไป VCC เป็นแค่ logic ไม่พอหมุน servo
2. **GND ร่วม** — ESP32 GND + PCA9685 GND + GND ของแหล่ง 5V ต้องต่อกัน
3. **ขา OE** บน PCA9685 → **GPIO 11** + **10kΩ pull-up ไป 3.3V** (ดู [`WIRING.md`](WIRING.md)) — **อย่า** ต่อ GND ตลอด
4. **Servo เสียบช่อง 0** ตรงกับที่กด Admin (ส้ม→เหลือง, แดง→แดง, น้ำตาล→ดำ)
5. **ทดสอบ servo ตรง** — สลับ servo ตัวอื่นหรือต่อกับแหล่ง 5V แยก

### Self-test ใน Serial Monitor (115200)

| คำสั่ง | ทำอะไร |
|--------|--------|
| `scan` | สแกน I2C — ต้องเห็น `0x40` |
| `test` | หมุนช่อง 0 สองทิศ 1.5s |
| `test 3` | หมุนช่อง 3 |
| `pulse 0 1700 2000` | ช่อง 0, pulse 1700μs, 2 วินาที |

- `scan` เห็น 0x40 แต่ servo ไม่หมุน → ESP32 + PCA9685 logic OK → ไฟ 5V / OE / servo / สาย
- `scan` ไม่เจออะไร → สาย I2C หรือ PCA9685 logic power

ตั้ง `BOOT_SERVO_TEST 0` ใน `.ino` เมื่อไม่ต้องการหมุนตอน boot

## Hardware safety (firmware 1.0.0+)

| ชั้นป้องกัน | รายละเอียด |
|-------------|------------|
| OE GPIO 11 | ปิด PWM ตอน boot + เมื่อ ESP32 ดับ (ต้อง rewire OE) |
| Early boot | `dispenserPreBoot()` ก่อน Serial/delay |
| Mutex | ปฏิเสธ dispense ซ้อน (HTTP 409 / ack `busy`) |
| RAII guard | หยุด servo เสมอหลัง spin แม้ reset กลางทาง |
| Idle stop | `stopAllServos()` ทุก ~30s ตอนไม่ busy |
| Production | `ALLOW_DISPENSE_ALL 0` — ปิด dispense_all จาก Admin heartbeat |

### Test checklist หลัง upload

1. Serial: `[boot] reset reason: ...` + `[dispenser] all channels stopped` — ไม่มี servo หมุนตอน boot
2. Admin test ch9 → หมุน 3s → หยุด
3. ถอด USB (หลัง rewire OE) → ch9 **ไม่** หมุนค้าง
4. กด test 2 ช่องพร้อมกัน → คำสั่งที่สอง reject `busy`
5. `scan` → เห็น `0x40`
6. `/status` → มี `pwmReady`, `servoSafe`
