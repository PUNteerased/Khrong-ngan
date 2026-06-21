export function getKioskS3BaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_KIOSK_S3_URL || "http://192.168.1.100"
  ).replace(/\/$/, "")
}

/** LAN fallback — embedded UI on ESP32-S3 firmware. */
export function getEmbeddedKioskUrl(): string {
  return `${getKioskS3BaseUrl()}/kiosk`
}

/** Production kiosk on Vercel (cloud relay via Render). */
export function getCloudKioskUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/kiosk`
  }
  return "https://khrong-ngan.vercel.app/kiosk"
}

export function isKioskLanMode(): boolean {
  return process.env.NEXT_PUBLIC_KIOSK_MODE === "lan"
}

export function isKioskCloudRelayMode(): boolean {
  return !isKioskLanMode()
}

/** HTTPS page cannot fetch HTTP LAN ESP32 (mixed content). */
export function isKioskMixedContentBlocked(): boolean {
  if (isKioskLanMode()) {
    if (typeof window === "undefined") return false
    const base = getKioskS3BaseUrl()
    return window.location.protocol === "https:" && base.startsWith("http:")
  }
  return false
}

export function mapKioskSessionError(
  raw: string | undefined,
  locale: "th" | "en"
): string {
  if (!raw?.trim()) {
    return locale === "en"
      ? "Something went wrong. Please try again."
      : "เกิดข้อผิดพลาด กรุณาลองใหม่"
  }
  const key = raw.trim().toLowerCase()
  const map: Record<string, { th: string; en: string }> = {
    "preview failed": {
      th: "ไม่สามารถตรวจสอบตั๋วได้ — ตรวจว่าตั๋วยังไม่หมดอายุ",
      en: "Could not verify ticket — check it has not expired",
    },
    "ticket expired": {
      th: "ตั๋วหมดอายุแล้ว — ขอ QR ใหม่จากแชท",
      en: "Ticket expired — get a new QR from chat",
    },
    unauthorized: {
      th: "ระบบตู้ไม่ได้รับอนุญาต — ตรวจ KIOSK_HEARTBEAT_SECRET",
      en: "Kiosk not authorized — check KIOSK_HEARTBEAT_SECRET",
    },
    "ticket not found": {
      th: "ไม่พบตั๋วในระบบ",
      en: "Ticket not found",
    },
    "cam offline": {
      th: "กล้องไม่เชื่อมต่อ — ตรวจ ESP-NOW และ WiFi",
      en: "Camera offline — check ESP-NOW and WiFi",
    },
    "kiosk offline": {
      th: "ตู้ไม่เชื่อมต่อ — รอ ESP32-S3 heartbeat",
      en: "Kiosk offline — waiting for ESP32-S3 heartbeat",
    },
    "cam peer not ready": {
      th: "กล้องยังไม่พร้อม — ตรวจ MAC และ firmware กล้อง",
      en: "Camera peer not ready — check MAC and camera firmware",
    },
    "scan timeout": {
      th: "หมดเวลาสแกน — ลองใหม่และถือ QR ใกล้กล้อง",
      en: "Scan timed out — try again and hold QR closer",
    },
    "scan start failed": {
      th: "เปิดกล้องไม่สำเร็จ — ลองใหม่",
      en: "Could not start camera scan — try again",
    },
    "preview too large": {
      th: "ข้อมูลตั๋วใหญ่เกินไป",
      en: "Ticket data too large",
    },
    "dispense failed": {
      th: "จ่ายยาไม่สำเร็จ",
      en: "Dispense failed",
    },
    "command in progress": {
      th: "มีคำสั่งค้างอยู่ — รอสักครู่",
      en: "Another command is in progress — please wait",
    },
  }
  const hit = map[key]
  if (hit) return locale === "en" ? hit.en : hit.th
  return raw
}
