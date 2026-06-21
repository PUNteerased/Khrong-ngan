# Kiosk Tablet Display (11" portrait)

หน้าจอสำหรับแท็บเล็ตบนตู้จ่ายยา — **ไม่ลิงก์จากแอปผู้ป่วย**

## URL

**แท็บเล็ตบนตู้ (bookmark):**
```
https://<your-host>/kiosk?token=<KIOSK_DISPLAY_TOKEN>
```

**ผู้ดูแล (login admin แล้ว):**
```
https://<your-host>/admin/kiosk
```
หรือจาก Admin → แท็บ **Kiosk** → **เปิดจอ Kiosk**

ครั้งแรกใส่ `?token=` แล้ว cookie จะถูกตั้ง — bookmark URL หลัง redirect ได้

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

## Deploy checklist

- Deploy **backend** (preview-ticket API)
- Upload **ESP32-S3** + **ESP32-CAM** firmware ล่าสุด
- ตั้ง `NEXT_PUBLIC_KIOSK_S3_URL` เป็น IP LAN ของ S3
- เปิดแท็บเล็ต fullscreen / kiosk mode → bookmark `/kiosk?token=...`

## Layout

| ส่วน | ความสูง |
|------|---------|
| Header (โล้โก้ + TH/EN + TTS) | 8vh |
| Emergency 1669 | 7vh |
| Main (scan / countdown / verify) | 65vh |
| Bottom (ยกเลิก / ยืนยัน) | 20vh |
