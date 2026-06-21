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

**ผู้ดูแล:** Admin → แท็บ **คีออส** → **เปิดจอคีออส**

## Architecture (cloud relay)

```
Tablet (Vercel HTTPS)
  → GET/POST /api/kiosk/display/*  (Render)
  → GET /api/kiosk/display/camera-frame  (JPEG relay, poll ~400ms ตอนสแกน)
ESP32-S3
  → POST /api/kiosk/heartbeat + session (Render)
  → POST /api/kiosk/session-sync เมื่อ phase เปลี่ยน
  → ตอน scanning (fallback): GET http://CAM:81/jpg → POST /api/kiosk/camera-frame
  ↔ ESP-NOW ESP32-CAM (QR scan — local only)
  → POST /api/kiosk/preview-ticket + redeem-ticket (Render)
ESP32-CAM
  → ตอน scanning: capture JPEG → POST /api/kiosk/camera-frame ทุก ~800ms (primary)
  → HTTP :81/jpg สำหรับ LAN preview / S3 relay fallback
```

**Live camera preview**
- **LAN** (`NEXT_PUBLIC_KIOSK_MODE=lan`): แท็บเล็ตโหลด `camPreviewUrl` จาก session ตรง (`http://CAM:81/jpg`)
- **Cloud (Vercel)**: **CAM** อัปโหลด JPEG ไป Render โดยตรง → แท็บเล็ต poll `GET /api/kiosk/display/camera-frame` (S3 relay เป็น fallback)

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
BACKEND_CAMERA_FRAME_URL=https://khrong-ngan.onrender.com/api/kiosk/camera-frame
KIOSK_HEARTBEAT_SECRET=...   // ตรงกับ S3 + Render
```

### ESP32-S3 firmware
```env
BACKEND_HEARTBEAT_URL=https://khrong-ngan.onrender.com/api/kiosk/heartbeat
BACKEND_SESSION_SYNC_URL=https://khrong-ngan.onrender.com/api/kiosk/session-sync
BACKEND_CAMERA_FRAME_URL=https://khrong-ngan.onrender.com/api/kiosk/camera-frame
KIOSK_HEARTBEAT_SECRET=...
HEARTBEAT_INTERVAL_MS=5000
HEARTBEAT_ACTIVE_INTERVAL_MS=2500   # ตอน scan/preview
```

## Flow

1. ผู้ป่วยคัดกรอง + รับ QR บนมือถือ
2. แท็บเล็ต: กด **เปิดกล้องสแกน** → คำสั่ง `scan_start` คิวที่ Render → S3 รับใน heartbeat
3. CAM อ่าน QR → S3 เรียก `POST /api/kiosk/preview-ticket`
4. แท็บเล็ต poll `GET /api/kiosk/display/session` → แสดงยา + คำเตือน
5. ผู้ป่วยกด **ยืนยัน** → `confirm_pickup` → redeem + หมุนมอเตอร์

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
| กล้อง preview ไม่ขึ้นบน Vercel | อัปโหลด CAM firmware ล่าสุด — ดู Serial `[cloud-relay] posted N bytes HTTP 200` |
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
