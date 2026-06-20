# ESP32-S3 — ตู้จ่ายยา LaneYa (Firmware เต็ม)

บอร์ดหลัก **ESP32-S3 N16R8** — WiFi, heartbeat, I2C (PCA9685), IR ตรวจยาร่วง, UART ไป ESP32-CAM

**การต่อสาย:** [`WIRING.md`](WIRING.md)

## โมดูล

| โมดูล | ไฟล์ | ฮาร์ดแวร์ |
|--------|------|-----------|
| WiFi | `wifi_manager.cpp` | 2.4 GHz |
| HTTP | `kiosk_http.cpp` | `/health`, `/status` |
| Heartbeat | `heartbeat.cpp` | → Render |
| จ่ายยา | `dispenser.cpp` | PCA9685, MG90S x10 ช่อง 0–9 |
| ตรวจยาร่วง | `drop_sensor.cpp` | IR GPIO 4, 5 |
| กล้อง | `cam_link.cpp` | ESP-NOW → ESP32-CAM |

เทส WiFi อย่างเดียว: [`../esp32-s3-connext/`](../esp32-s3-connext/)  
Firmware กล้อง: [`../esp32-cam-laneya/`](../esp32-cam-laneya/)

## อัปโหลด

**Arduino IDE:** `arduino-ide/esp32-s3-laneya-kiosk/esp32-s3-laneya-kiosk.ino`

**PlatformIO:**

```powershell
cd hardware\esp32-s3-laneya-kiosk
copy include\config.example.h include\config.h
.\scripts\upload.ps1
```

## พิน GPIO (สรุป)

| GPIO | ใช้กับ |
|------|--------|
| 9 | I2C SDA → PCA9685 |
| 10 | I2C SCL → PCA9685 |
| 4 | IR ตรวจยาร่วง ซ้าย |
| 5 | IR ตรวจยาร่วง ขวา |

กล้อง ESP32-CAM: **ESP-NOW** (ไม่ใช้ GPIO) — ตั้ง `CAM_ESPNOW_MAC` ใน `config.h`
