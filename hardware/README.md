# LaneYa Hardware

โฟลเดอร์นี้เก็บ **firmware** ของอุปกรณ์ที่เชื่อมกับเว็บ LaneYa

## อุปกรณ์ในโปรเจกต์

| อุปกรณ์ | ใช้กับ | สถานะ firmware |
|---------|--------|----------------|
| **ESP32-S3 N16R8** | ตู้จ่ายยาหลัก — WiFi, heartbeat, servo (ภายหลัง) | [`esp32-s3-laneya-kiosk/`](esp32-s3-laneya-kiosk/) — **เทสเชื่อมเว็บก่อน** |
| **PCA9685 + MG90S 360°** | มอเตอร์หมุนช่องยา | ยังไม่ใส่ — หลังเทส WiFi/เว็บผ่าน |
| **ESP32-CAM + OV3660** | กล้อง (สแกน/ถ่ายภาพ) | ยังไม่ใส่ — โฟลเดอร์แยกในอนาคต |

---

## Arduino IDE vs PlatformIO — ใช้อันไหน?

| | **Arduino IDE** | **PlatformIO** |
|---|----------------|----------------|
| เหมาะกับ | **เทสครั้งแรก / โครงงานโรงเรียน** | โปรเจกต์ใหญ่ หลายไฟล์ หลายบอร์ด |
| ติดตั้ง | ง่าย — โหลด ESP32 board แล้วเปิด `.ino` | ต้องติดตั้ง extension หรือ `pip install platformio` |
| ไลบรารี | ติดตั้งผ่าน Library Manager | ใส่ใน `platformio.ini` |
| Serial Monitor | มีในตัว | ผ่าน PlatformIO หรือ `scripts/monitor.ps1` |

### คำแนะนำ

**ตอนนี้ (เทสเชื่อมเว็บ): ใช้ Arduino IDE** — เปิดไฟล์ `.ino` แก้ WiFi แล้ว Upload ได้เลย ไม่ต้องมีคำสั่ง `pio`

**ภายหลัง** (เพิ่ม PCA9685 + กล้อง ESP32-CAM หลายโมดูล): ค่อยย้ายมา PlatformIO หรือแยกโฟลเดอร์ตามบอร์ด

---

## Phase 1 — เทสเชื่อมเว็บ (ESP32-S3 N16R8)

### 1. Arduino IDE

1. ติดตั้ง [Arduino IDE](https://www.arduino.cc/en/software)
2. **File → Preferences → Additional boards manager URLs** ใส่:
   ```
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```
3. **Tools → Board → Boards Manager** → ติดตั้ง **esp32** (Espressif)
4. เปิดไฟล์:
   ```
   hardware/esp32-s3-laneya-kiosk/arduino-ide/esp32-s3-laneya-kiosk/esp32-s3-laneya-kiosk.ino
   ```
5. ตั้งค่าบอร์ด (เมนู Tools):

   | รายการ | ค่า |
   |--------|-----|
   | Board | **ESP32S3 Dev Module** |
   | USB CDC On Boot | **Enabled** |
   | Flash Size | **16MB (128Mb)** |
   | PSRAM | **OPI PSRAM** |
   | Partition Scheme | **16M Flash (3MB APP / 9.9MB FATFS)** หรือ Default 16MB |

6. แก้ `WIFI_SSID`, `WIFI_PASSWORD`, `KIOSK_HEARTBEAT_SECRET` ด้านบนไฟล์ `.ino`
7. เลือก Port (COM…) → **Upload**
8. **Tools → Serial Monitor** 115200 — ดู IP ของบอร์ด

### 2. ทดสอบบนบอร์ด (ไม่ผ่านเว็บ)

ในเบราว์เซอร์ (WiFi เดียวกับ ESP32):

- `http://<IP-บอร์ด>/health` → `{"ok":true,...}`
- `http://<IP-บอร์ด>/status` → มี `lat`, `lng`, `online`

### 3. ทดสอบเชื่อม backend (Render)

บน Render ตั้ง:

```env
KIOSK_HEARTBEAT_SECRET=<ตรงกับใน .ino>
KIOSK_LAT=17.0075
KIOSK_LNG=99.8260
```

Serial Monitor ควรเห็น `[heartbeat] 200` ทุก ~60 วินาที

### 4. ทดสอบบนหน้าเว็บ

เปิด https://khrong-ngan.vercel.app/contact — ควรเห็น **ตู้จ่ายยาออนไลน์** และแผนที่อัปเดต

---

## PlatformIO (ทางเลือก)

```powershell
pip install platformio
cd hardware\esp32-s3-laneya-kiosk
.\scripts\upload.ps1
```

รายละเอียด: [`esp32-s3-laneya-kiosk/README.md`](esp32-s3-laneya-kiosk/README.md)
