# การต่อสาย — ตู้จ่ายยา LaneYa

ESP32-S3 N16R8 เป็นบอร์ดหลัก เชื่อมเว็บแอป + ควบคุมอุปกรณ์รอบข้าง

## ภาพรวมอุปกรณ์

| อุปกรณ์ | จำนวน | หน้าที่ |
|---------|-------|---------|
| ESP32-S3 N16R8 | 1 | สมองกล — WiFi, heartbeat, I2C, ESP-NOW, GPIO |
| PCA9685 + MG90S 360° | 10 | หมุนช่องยา (ช่อง PWM 0–9) |
| IR Barrier Module | 2 | ตรวจยาร่วง (ซ้าย / ขวา) |
| ESP32-CAM + OV3630 | 1 | กล้อง — **ESP-NOW** กับ S3 (ไม่ต้องต่อสายสัญญาณ) |

---

## I2C → PCA9685 (มอเตอร์)

| ESP32-S3 | สัญญาณ | PCA9685 |
|----------|--------|---------|
| GPIO **9** | SDA | SDA (แผงพินด้านข้าง) |
| GPIO **10** | SCL | SCL (แผงพินด้านข้าง) |
| GPIO **11** | OE | OE (Output Enable) — ดูด้านล่าง |
| 3.3V | VCC | VCC |
| GND | GND | GND |

**Servo ช่อง 0–9** — เสียบ MG90S 360° ตามลำดับช่องยา:

| สาย Servo | แถว PCA9685 |
|-----------|-------------|
| ส้ม (Signal) | เหลือง (บน) |
| แดง (V+) | แดง (กลาง) — ไฟมอเตอร์แยก 5–6V แนะนำ |
| น้ำตาล (GND) | ดำ (ล่าง) |

> MG90S แบบ **360°** — หมุนด้วย pulse ~1200–2000μs, **หยุด = ตัด PWM** (`setPWM(ch,0,4096)`) อย่าส่ง 1500μs ตอน idle (จะหมุนช้าๆ)

---

## IR Barrier — ตรวจยาร่วง

| เซนเซอร์ | OUT | ESP32-S3 | ไฟเลี้ยง |
|----------|-----|----------|----------|
| ฝั่งซ้าย | OUT | GPIO **4** | VCC 5V, GND ร่วม |
| ฝั่งขวา | OUT | GPIO **5** | VCC 5V, GND ร่วม |

เมื่อลำแสงถูกตัด (มียาร่วง) → firmware นับใน `[drop] LEFT/RIGHT beam broken`

---

## ESP-NOW → ESP32-CAM (ไร้สาย)

**ไม่ต้องต่อ TX/RX** — กล้องวางห่างจาก S3 ได้ (ระยะในอาคาร ~10–30 m)

| การต่อ | รายละเอียด |
|--------|------------|
| ไฟเลี้ยง CAM | 5V + GND แยกสายไปที่กล้อง |
| สัญญาณ | ESP-NOW 2.4 GHz (ใช้ WiFi chip ในตัว) |

### ตั้งค่า MAC (ครั้งแรก)

1. Upload **ESP32-CAM** → Serial แสดง `[cam] MAC AA:BB:...`
2. ใส่ใน S3 `config.h` → `CAM_ESPNOW_MAC {0xAA, 0xBB, ...}`
3. Upload **ESP32-S3** → Serial แสดง `[cam] S3 MAC CC:DD:...`
4. ใส่ใน CAM `.ino` → `S3_ESPNOW_MAC {0xCC, 0xDD, ...}` → upload กล้องอีกครั้ง

ข้อความ: `PING` / `PONG` ทุก 30 วินาที — S3 แสดง `camOnline` ใน `/status`

Firmware กล้อง: [`../esp32-cam-laneya/`](../esp32-cam-laneya/)

> Phase 2: รูปถ่ายให้ CAM อัปโหลด WiFi เอง ส่งแค่ URL กลับทาง ESP-NOW

---

## แผนภาพ (ย่อ)

```
                    ┌─────────────────┐
                    │  ESP32-S3 N16R8 │
                    │   (บอร์ดหลัก)    │
                    └───┬───┬─────────┘
            I2C 9/10    │   │  ESP-NOW ~~~ (ไร้สาย)
                 ┌──────┘   └──────────┐
                 ▼                     ▼
          ┌──────────┐            ┌───────────┐
          │ PCA9685  │  GPIO 4,5  │ ESP32-CAM │
          │ Servo 0-9│ ──► IR x2  │  OV3630   │
          └──────────┘            └───────────┘
                 │
            MG90S x10
```

---

## PCA9685 OE — กัน servo หมุนค้าง (สำคัญ)

ถ้าถอด USB แล้ว ESP32 ดับ แต่ **PCA9685 ยังมีไฟ 5V** ค่า PWM ช่องสุดท้ายอาจค้าง → servo หมุนไม่หยุด (มักเป็น ch9 ถ้าเคย test ช่องสุดท้าย)

### ต่อสาย OE (แนะนำ — ต้องทำ)

```
PCA9685 OE ──► GPIO 11 (ESP32-S3)
              │
              └── 10kΩ pull-up → 3.3V
```

| สถานะ OE | ผล |
|----------|-----|
| **HIGH** | ปิด PWM ทุกช่อง — servo หยุด |
| **LOW** | เปิด PWM ตาม register |

- Firmware ตั้ง **OE=HIGH** ทันทีตอน boot → stop ทุกช่อง → **OE=LOW**
- ESP32 ดับ (ถอด USB) → GPIO ลอย → pull-up ดึง OE **HIGH** → servo หยุดเอง

> **อย่า** ต่อ OE ไป GND ตลอด — จะทำให้ PWM เปิดแม้ ESP32 ดับ

### ตอนพัฒนา (ก่อนถอด USB)

1. ปิดสวิตช์ไฟ 5V ที่ PCA9685 **หรือ**
2. ถอด USB หลัง rewire OE แล้ว — servo ควรไม่หมุนค้าง

### Software safety (ใน firmware แล้ว)

- `dispenserPreBoot()` — OE HIGH ก่อน Serial/delay
- `stopAllServos()` ทุกช่องตอน boot + ทุก ~30s ตอน idle
- Mutex — ปฏิเสธคำสั่ง dispense ซ้อน
- `ALLOW_DISPENSE_ALL 0` — ปิด dispense_all จาก heartbeat (production)

---

## ค่าใน firmware

ดู `include/config.example.h` — คัดลอกเป็น `config.h` แล้วปรับ pulse มอเตอร์ + `CAM_ESPNOW_MAC`
