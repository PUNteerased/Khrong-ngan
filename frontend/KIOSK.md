# Kiosk Tablet Display (11" portrait)

หน้าจอสำหรับแท็บเล็ตบนตู้จ่ายยา — **ไม่ลิงก์จากแอปผู้ป่วย**

## URL (Production — แนะนำ)

**แท็บเล็ตบนตู้ (HTTPS ผ่าน Vercel + cloud relay):**
```
https://khrong-ngan.vercel.app/kiosk?token=<KIOSK_DISPLAY_TOKEN>
```
ครั้งแรกใส่ `?token=` แล้ว cookie จะถูกตั้ง — bookmark URL หลัง redirect ได้

Flow: แท็บเล็ต → Render HTTPS → ESP32-S3 ดึงคำสั่งผ่าน **heartbeat** (แบบเดียวกับทดสอบ servo ใน Admin)

**LAN fallback (ไม่ต้องใช้ Render สำหรับ UI):**
```
http://<S3-IP>/kiosk
```
เช่น `http://10.207.223.130/kiosk` — UI ฝังใน firmware ESP32-S3

**Dev บน PC ใน LAN:**
```
http://<PC-IP>:3000/kiosk?token=<KIOSK_DISPLAY_TOKEN>
```
หรือ `NEXT_PUBLIC_KIOSK_MODE=lan` เพื่อเรียก S3 ตรงจาก Next.js

**ผู้ดูแล:** Admin → แท็บ **คีออส** → เปิด URL จอคีออส (`/kiosk`)

## Architecture (cloud relay)

```
Tablet (Vercel HTTPS)
  → GET/POST /api/kiosk/display/*  (Render)
  → GET /api/kiosk/display/camera-frame  (poll ~450ms)
ESP32-S3
  → POST heartbeat + session-sync (Render)
  → GET http://CAM:81/jpg ทุก ~450ms → POST /api/kiosk/camera-frame
  ↔ ESP-NOW ESP32-CAM (QR scan)
  → POST preview-ticket + redeem-ticket (Render)
ESP32-CAM
  → capture JPEG ใน loop ทุก ~450ms → cache ที่ GET :81/jpg
  → QR reader ทำงานระหว่าง capture (GET /jpg ไม่ pause QR)
```

**Live camera preview**
- **LAN** (`NEXT_PUBLIC_KIOSK_MODE=lan`): แท็บเล็ต poll `http://CAM:81/jpg` ตรง (~450ms)
- **Cloud (Vercel)**: S3 relay JPEG → Render → แท็บเล็ต poll `GET /api/kiosk/display/camera-frame` (~450ms, ~2 fps)

## Environment

### Vercel (frontend)
```env
NEXT_PUBLIC_API_URL=https://khrong-ngan.onrender.com
KIOSK_DISPLAY_TOKEN=change-me-kiosk-display
# optional LAN dev:
# NEXT_PUBLIC_KIOSK_MODE=lan
# NEXT_PUBLIC_KIOSK_S3_URL=http://10.207.223.130
```

### Render (backend)
```env
KIOSK_HEARTBEAT_SECRET=...   # ตรงกับ firmware S3
```

### ESP32-CAM firmware

```cpp
#define PREVIEW_CAPTURE_INTERVAL_MS 450   // ~2 fps live preview
#define QR_PAUSE_MS 80                    // pause QR ช่วง capture เท่านั้น
```

Upload `.ino` ล่าสุด — CAM ไม่ upload HTTPS ไป Render เอง (S3 relay แทน)

### ESP32-S3 firmware
```env
BACKEND_HEARTBEAT_URL=https://khrong-ngan.onrender.com/api/kiosk/heartbeat
BACKEND_SESSION_SYNC_URL=https://khrong-ngan.onrender.com/api/kiosk/session-sync
BACKEND_CAMERA_FRAME_URL=https://khrong-ngan.onrender.com/api/kiosk/camera-frame
KIOSK_HEARTBEAT_SECRET=...
HEARTBEAT_INTERVAL_MS=5000
HEARTBEAT_ACTIVE_INTERVAL_MS=2500   # ตอน scan/preview
CAMERA_FRAME_INTERVAL_MS=450        # S3 relay ~2 fps
```

## Flow

1. ผู้ป่วยคัดกรอง + รับ QR บนมือถือ (รหัสรูปแบบ `A1-0001-ABCDEF`, อายุ **15 นาที**)
2. แท็บเล็ต: **เปิดกล้องสแกน** หรือ **พิมพ์รหัส** ใต้ปุ่มสแกน
3. ระบบเรียก `preview-ticket` — ถ้าหมดอายุได้ HTTP **410** (ไม่เข้าหน้ายืนยัน)
4. แท็บเล็ต poll `GET /api/kiosk/display/session` → แสดงยา + countdown อายุตั๋ว
5. ผู้ป่วยกด **ยืนยัน** (ปิดอัตโนมัติเมื่อหมดเวลา) → `confirm_pickup` → redeem + หมุนมอเตอร์

### พิมพ์รหัส (แทนสแกน QR)

พิมพ์ **12 ตัวติดกัน** ไม่ต้องใส่ `-` เช่น `A10001ABCDEF` → ระบบแปลงเป็น `A1-0001-ABCDEF` อัตโนมัติ  
วางจากแชทแบบมี `-` ก็ได้

| Mode | Endpoint |
|------|----------|
| Cloud (Vercel) | `POST /api/kiosk/display/submit-code` body `{"code":"A1-0001-ABCDEF"}` |
| LAN | `POST http://<S3-IP>/kiosk/submit-code` |

Cloud: backend preview ทันที + คิว `submit_code` ให้ S3 เก็บ `pendingCode` สำหรับ confirm

## Reset session (LAN)

```powershell
curl.exe -X POST http://<S3-IP>/kiosk/scan/cancel
```

Cloud mode: กด **ยกเลิก** หรือ **ลองใหม่** บนจอ Vercel (ส่ง `scan_cancel` ไป Render)

## Troubleshooting

| อาการ | สาเหตุ |
|--------|--------|
| Banner ตู้ offline บน Vercel | S3 ยังไม่ heartbeat ไป Render / WiFi ขาด |
| กดสแกนแล้วไม่เริ่ม | รอ heartbeat 2–5s / firmware เก่าไม่รองรับ scan_start |
| scan timeout | QR ไม่ถูกอ่าน — ดู Serial CAM |
| กล้อง preview ไม่ขยับ / ค้าง frame แรก | อัปโหลด CAM+S3 firmware ล่าสุด — CAM capture ทุก 450ms, S3 relay 450ms |
| QR ไม่ติดหลัง preview ลื่นขึ้น | ลอง `PREVIEW_CAPTURE_INTERVAL_MS 600` ใน CAM — trade-off fps ↔ scan |
| กล้อง preview ไม่ขึ้นบน Vercel | S3 Serial `[cam-relay] posted N bytes` — ทดสอบ `curl http://<CAM-IP>:81/health` |
| `409 command in progress` | คำสั่ง scan ค้าง — กดยกเลิกหรือรอ 8s แล้วลองใหม่ (backend ล้าง stale อัตโนมัติ) |
| S3 Serial `CAM GET HTTP -1` | S3→CAM HTTP ล้มเหลว — ไม่กระทบ cloud preview ถ้า CAM upload เองแล้ว / ทดสอบ `curl http://<CAM-IP>:81/health` จาก PC |
| CAM reboot / ตัวอักษรแปลกๆ | firmware เก่าใช้กล้องพร้อม QR — อัปโหลด CAM ล่าสุด (pause QR ก่อน capture) |
| CAM `/health` เป็น `scanning:false` ตอนสแกน | CAM ไม่ได้รับ SCAN — ดู Serial CAM ต้องมี `[espnow] << SCAN` → `[scan] started` |
| mixed content (LAN mode) | ตั้ง `NEXT_PUBLIC_KIOSK_MODE` ไม่ใช่ `lan` บน Vercel |

## Deploy checklist

1. Deploy **backend** (display API + session-sync)
2. Deploy **frontend** Vercel
3. Upload **ESP32-S3** + **ESP32-CAM** firmware ล่าสุด
4. ตั้ง `KIOSK_HEARTBEAT_SECRET` ให้ตรงกันทุกที่
5. แท็บเล็ต bookmark `https://khrong-ngan.vercel.app/kiosk?token=...`
