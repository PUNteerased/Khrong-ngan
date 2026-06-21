# ESP32-CAM — กล้องตู้จ่ายยา LaneYa

บอร์ดกล้อง **ESP32-CAM-MB + OV3660** สื่อสารกับ ESP32-S3 หลักผ่าน **ESP-NOW** (ไม่ต้องต่อสาย TX/RX)

## การต่อ

| สาย | หมายเหตุ |
|-----|----------|
| 5V, GND | ไฟเลี้ยงกล้อง (วางห่างจาก S3 ได้) |
| ~~TX/RX~~ | **ไม่ใช้** — ใช้ ESP-NOW แทน |

## Library QR (Arduino IDE)

**ไม่มีใน Library Manager** และ **Add .ZIP Library มัก error `library not valid`** (repo ต้นฉบับ alvarowolfx แยกไฟล์ไว้ใน `include/` ไม่เข้ากับ Arduino IDE 2.x)

### วิธีที่แนะนำ — สคริปต์ (Windows)

จาก PowerShell ในโฟลเดอร์โปรเจกต์:

```powershell
powershell -ExecutionPolicy Bypass -File hardware/esp32-cam-laneya/scripts/install-qrcode-lib.ps1
```

ปิด–เปิด Arduino IDE → upload `.ino` ใหม่

### วิธีมือ — copy โฟลเดอร์

1. ดาวน์โหลด ZIP (fork ที่ใช้ได้กับ Arduino IDE):  
   https://github.com/hardwareliberopinerolo/ESP32QRCodeReader/archive/refs/heads/master.zip
2. แตก ZIP → ได้โฟลเดอร์ `ESP32QRCodeReader-master`
3. **เปลี่ยนชื่อ** เป็น `ESP32QRCodeReader`
4. **ย้ายทั้งโฟลเดอร์** ไปโฟลเดอร์ `libraries` ที่ IDE ใช้จริง (ดูจาก library อื่น เช่น ArduinoJson):
   - **OneDrive (มักเป็นแบบนี้):** `C:\Users\<ชื่อ>\OneDrive\Documents\Arduino\libraries\ESP32QRCodeReader\`
   - **ไม่ใช้ OneDrive:** `C:\Users\<ชื่อ>\Documents\Arduino\libraries\ESP32QRCodeReader\`
   (ข้างในมี `library.properties` + โฟลเดอร์ `src/`)
5. ปิด–เปิด Arduino IDE → upload ใหม่

Serial ต้องขึ้น **`[qr] ESP32QRCodeReader ready`** (ไม่ใช่ `ติดตั้ง ESP32QRCodeReader...`)

> **Compile error `ps_malloc` / `free` / `memcpy`** (ESP32 core 3.x): รัน  
> `powershell -ExecutionPolicy Bypass -File hardware/esp32-cam-laneya/scripts/patch-qrcode-lib.ps1 -LibDir "C:\Users\<ชื่อ>\OneDrive\Documents\Arduino\libraries\ESP32QRCodeReader"`  
> หรือติดตั้งใหม่ด้วย `install-qrcode-lib.ps1` (มี patch อัตโนมัติ)

> อย่าใช้ repo ต้นฉบับ alvarowolfx กับ Add ZIP — ถ้าจำเป็น ต้อง copy ไฟล์จาก `include/` ไปรวมใน `src/` เอง

## QR format

มือถือแสดง QR เป็นข้อความอย่างเดียว เช่น `A1-0001-XYZABC`  
CAM สแกนแล้วส่ง ESP-NOW → S3: `QR:A1-0001-XYZABC`

## ตั้งค่า MAC

1. Upload `.ino` → Serial Monitor **115200**
2. จด `[cam] MAC xx:xx:xx:xx:xx:xx` → ใส่ใน S3 `.ino` → `CAM_ESPNOW_MAC`
3. จด MAC จาก S3 → แก้ `S3_ESPNOW_MAC` ใน `.ino` → upload กล้องอีกครั้ง

**ESP-NOW ต้อง sync WiFi channel** — CAM ต่อ WiFi **SSID เดียวกับ S3** (`WIFI_SSID` / `WIFI_PASSWORD` ใน `.ino` บรรทัดบน) แม้ไม่ใช้ internet ก็ต้องต่อให้ได้ แล้ว Serial จะขึ้น `[wifi] OK ... ch=7` ตรงกับ `peer CAM ... ch=7` บน S3

ตัวอย่าง MAC กล้อง `28:05:A5:24:16:AC`:

```cpp
#define CAM_ESPNOW_MAC {0x28, 0x05, 0xA5, 0x24, 0x16, 0xAC}
```

## Arduino IDE

1. เปิด `arduino-ide/esp32-cam-laneya/esp32-cam-laneya.ino`
2. เลือกบอร์ด **AI Thinker ESP32-CAM**
3. ต่อ USB ที่ **ESP32-CAM-MB** → Upload (กด IO0 + RST ถ้าจำเป็น)

Serial ต้องเห็น MAC จริง — **ถ้าเป็น `00:00:00:00:00:00` ไม่ถูกต้อง** (reset / เปลี่ยนสาย USB)

เมื่อ S3 ส่ง `SCAN` กล้องสแกน QR **60 วินาที** — ดู `[espnow] << SCAN` แล้ว `[scan] started (60s)` บน Serial ของ CAM

## ตั้งค่า cloud preview (Vercel)

Preview ไป Render ผ่าน **ESP32-S3 relay** (CAM ไม่ upload HTTPS เอง):

```cpp
// S3 .ino
#define BACKEND_CAMERA_FRAME_URL "https://khrong-ngan.onrender.com/api/kiosk/camera-frame"
#define CAMERA_FRAME_INTERVAL_MS 450
```

Serial S3 ระหว่างสแกน: `[cam-relay] posted N bytes`

## Preview ภาพกล้อง (port 81 + S3 relay)

Firmware ล่าสุด:
- **Capture ใน loop** ทุก `PREVIEW_CAPTURE_INTERVAL_MS` (450ms) ขณะ scanning
- **GET /jpg serve cache** — ไม่ pause QR ตอน HTTP request
- **Pause QR ชั่วคราว** (~80ms) เฉพาะตอน capture JPEG (แยกจาก GET)
- S3 relay ไป Render ทุก `CAMERA_FRAME_INTERVAL_MS` (450ms)

| URL | หน้าที่ |
|-----|---------|
| `http://<CAM-IP>:81/jpg` | JPEG ล่าสุดจาก cache (ขณะ scanning) |
| `http://<CAM-IP>:81/health` | `{"scanning":true/false,"hasFrame":...,"jpgBytes":...}` |
| `http://<CAM-IP>:81/scan/start` | เริ่มสแกน (fallback ถ้า ESP-NOW หลุด) |

ถ้า QR ไม่ติด: เพิ่ม `PREVIEW_CAPTURE_INTERVAL_MS` เป็น 600–700 ใน CAM `.ino`

ทดสอบจาก PC (WiFi เดียวกัน):

```powershell
curl.exe http://192.168.1.13:81/health
```

- ตอนยังไม่สแกน: `"scanning":false` = ปกติ
- ระหว่างสแกนบนคีออส: ต้องเป็น `"scanning":true`

Serial boot: `[preview] http://192.168.x.x:81/jpg`

CAM ส่ง `IP:192.168.x.x` ไป S3 ผ่าน ESP-NOW → S3 LAN kiosk แสดงภาพจาก `camPreviewUrl`

### IDE ค้าง / upload ไม่จบ (Windows + ESP32-CAM)

มักไม่ใช่ crash จริง — **compile ช้า** (library QR ใหญ่) หรือ **esptool รอ boot mode**

**ก่อน upload ทุกครั้ง**

1. **ปิด Serial Monitor** (COM ค้าง = upload ค้าง)
2. Tools → Upload Speed → **115200**
3. กด Upload → **ค้าง IO0** → กด **RST** → ปล่อย RST → ปล่อย IO0 เมื่อเห็น `Connecting...`

**ถ้า IDE ค้างนาน (>2 นาที) ที่ “Building sketch”**

- Library ใน **OneDrive** ทำให้ช้า — ตั้งโฟลเดอร์ `Arduino\libraries` เป็น “Always keep on this device” หรือย้ายออกจาก OneDrive
- ปิด IDE → Task Manager → ฆ่า **arduino-cli**, **esptool**, **java** ที่ค้าง → เปิด IDE ใหม่
- Sketch + QR library compile ~1–3 นาทีครั้งแรก (ปกติ)

**ถ้าค้างที่ “Connecting........”**

- IO0+RST อีกครั้ง / เปลี่ยนสาย USB / พอร์ต COM
- Tools → Erase All Flash Before Sketch Upload → **Enabled** (ครั้งเดียว)

### Upload เสร็จแล้วกด RST → IDE ค้างทันที

**Serial Monitor เปิดอยู่** แล้วกด RST = boot log ท่วม → Arduino IDE 2 บน Windows มัก **ค้าง UI** (บอร์ดยังรันได้)

1. Upload เสร็จ → **ปิด Serial Monitor ก่อน**
2. กด **RST**
3. รอ ~2 วิ → เปิด Monitor ใหม่ (115200)

Settings (Ctrl+,) → ปิด **Automatic panel open after upload** ถ้ามี

ทางเลือก: PuTTY หรือ `arduino-cli monitor -p COM4 -c 115200`

### Serial Monitor เปิดแล้วว่างเปล่า (ไม่มีข้อความเลย)

1. **Monitor เปิดอยู่ → กด RST อีกครั้ง** (boot ผ่านไปแล้วจะไม่เห็นอะไร)
2. **อย่าค้าง IO0** ตอนกด RST — ค้าง = download mode = Serial เงียบ
   - Upload: ค้าง IO0 → RST → ปล่อย IO0
   - หลัง upload: **ปล่อย IO0 แล้วกด RST ครั้งเดียว**
3. ตรวจ **115200 baud** + พอร์ต **COM4** ตรงกับตอน upload
4. Upload sketch ใหม่ (`.ino` ล่าสุดมี `[boot] start` และ `[cam] alive` ทุก 5 วิ)
5. ถ้ายังว่าง — เปลี่ยนสาย USB / พอร์ต USB อื่น / ไฟ 5V ที่ MB

แผนผังทั้งระบบ: [`../esp32-s3-laneya-kiosk/WIRING.md`](../esp32-s3-laneya-kiosk/WIRING.md)
