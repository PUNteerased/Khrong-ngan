/** จัดรูปเบอร์มือถือไทย 10 หลัก เป็น 0xx-xxx-xxxx */
export function formatThaiMobileInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
}

/** ส่งไป API / เก็บในฐานข้อมูล — เฉพาะตัวเลข */
export function phoneDigitsOnly(displayOrRaw: string): string {
  return displayOrRaw.replace(/\D/g, "")
}
