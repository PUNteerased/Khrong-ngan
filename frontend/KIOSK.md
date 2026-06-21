# Kiosk Tablet Display (11" portrait)

หน้าจอสำหรับแท็บเล็ตบนตู้จ่ายยา — **ไม่ลิงก์จากแอปผู้ป่วย**

## URL

**แท็บเล็ตบนตู้ (bookmark):**
```
http://<PC-IP>:3000/th/kiosk?token=<KIOSK_DISPLAY_TOKEN>
```

**ผู้ดูแล (login admin แล้ว):**
```
http://<PC-IP>:3000/th/admin/kiosk
```
หรือจาก Admin → แท็บ **คีออส** → **เปิดจอคีออส**

ครั้งแรกใส่ `?token=` แล้ว cookie จะถูกตั้ง — bookmark URL หลัง redirect ได้

## ห้ามใช้ Vercel HTTPS บนแท็บเล็ตตู้

แท็บเล็ตที่ตู้ต้องเรียก ESP32-S3 ผ่าน **HTTP บน LAN** (`NEXT_PUBLIC_KIOSK_S3_URL=http://10.x.x.x`)

ถ้าเปิด UI จาก **`https://...vercel.app`** เบราว์เซอร์จะ **บล็อก** fetch ไป `http://10.x.x.x` (mixed content) — กดสแกนแล้วไม่ทำงาน หรือเห็น banner แดงบนจอ

**วิธีที่ถูก (ชั่วคราว / dev):**
```bash
cd frontend && npm run dev -- -H 0.0.0.0
```
แท็บเล็ตเปิด `http://<IP-คอม>:3000/th/admin/kiosk` (WiFi เดียวกับ S3)

**Production บนตู้:** รัน Next.js บน PC/mini PC ใน LAN, หรือ static export + nginx บน HTTP ใน WiFi ตู้ — **ไม่ใช้** Vercel HTTPS สำหรับแท็บเล็ตที่ต้องคุย ESP32 โดยตรง

## Environment (frontend)

```env
# IP ของ ESP32-S3 ใน WiFi เดียวกับแท็บเล็ต
NEXT_PUBLIC_KIOSK_S3_URL=http://10.207.223.130

# รหัสป้องกันไม่ให้ผู้ใช้ทั่วไปเข้า /kiosk
KIOSK_DISPLAY_TOKEN=change-me-kiosk-display
```

## Flow

1. ผู้ป่วยคัดกรอง + รับ QR บนมือถือ
2. แท็บเล็ต: กด **เปิดกล้องสแกน** → S3 ส่ง SCAN ไป ESP32-CAM (45 วิ)
3. CAM อ่าน QR → S3 เรียก `POST /api/kiosk/preview-ticket`
4. แท็บเล็ตแสดงยา + คำเตือน → ผู้ป่วยกด **ยืนยัน**
5. S3 redeem + หมุนมอเตอร์จ่ายยา

## Troubleshooting — แสกนไม่ติด

เช็คตามลำดับ:

1. เปิด UI จาก **HTTP บน LAN** (ไม่ใช่ Vercel HTTPS) — ดู banner บนจอถ้า mixed content
2. `http://<S3-IP>/status` → `"camOnline": true`
3. Serial CAM: เห็น `[scan] started` หลังกดสแกน
4. Serial CAM: `[qr] decoded` หรือ `[qr] invalid ticket format` ถ้า QR ผิดรูปแบบ
5. Serial S3: `[pickup] preview ok` หรือ `[pickup] HTTP 401/404/410 ...`
6. กดสแกนตอนกล้อง offline → API ตอบ **503** `cam offline` (ไม่นับถอยหลัง 45s เปล่าๆ)

| อาการ | สาเหตุที่พบบ่อย |
|--------|----------------|
| Banner แดง mixed content | เปิดจาก `https://vercel.app` |
| `connected=false` / S3 offline | IP ผิด, WiFi คนละเครือข่าย, S3 ดับ |
| `camOnline=false` | ESP-NOW ไม่จับคู่, MAC/channel ไม่ตรง |
| Countdown แต่ไม่สแกน | CAM ไม่ได้รับ SCAN — ดู Serial CAM |
| Error หลังสแกน | ตั๋วหมดอายุ / secret ไม่ตรง / backend cold start |

## Deploy checklist

- Deploy **backend** (preview-ticket API)
- Upload **ESP32-S3** + **ESP32-CAM** firmware ล่าสุด
- ตั้ง `NEXT_PUBLIC_KIOSK_S3_URL` เป็น IP LAN ของ S3
- เปิดแท็บเล็ต fullscreen / kiosk mode → bookmark `/kiosk?token=...` บน **HTTP LAN**

## Layout

| ส่วน | ความสูง |
|------|---------|
| Header (โล้โก้ + TH/EN + TTS) | 8vh |
| Emergency 1669 | 7vh |
| Main (scan / countdown / verify) | 65vh |
| Bottom (ยกเลิก / ยืนยัน) | 20vh |
