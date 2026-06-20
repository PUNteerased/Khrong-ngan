import { isValidSlotId } from "./slotMapping.js"

const SLOT_IN_TEXT_RE =
  /(?:ช่อง\s*|slot\s*|slotId\s*[:=]?\s*)?([AB][1-5])\b/gi
const SLOT_IN_JSON_RE = /"drug_slot_id"\s*:\s*"([AB][1-5])"/i

/** Extract kiosk slot id from Thai text or partial JSON in Dify answer. */
export function extractSlotFromText(raw: string): string | null {
  const text = String(raw ?? "")

  const jsonMatch = text.match(SLOT_IN_JSON_RE)
  if (jsonMatch?.[1]) {
    const key = jsonMatch[1].toUpperCase()
    if (isValidSlotId(key)) return key
  }

  const matches = [...text.matchAll(SLOT_IN_TEXT_RE)]
  for (const m of matches) {
    const key = m[1]!.toUpperCase()
    if (isValidSlotId(key)) return key
  }

  return null
}

const QR_REQUEST_RE =
  /(?:ขอ\s*)?(?:คิวอา|qr\s*code|qrcode|qr|ตั๋ว\s*qr|ออกตั๋ว|รับตั๋ว|รับยา)/i

export function isQrRequestIntent(message: string): boolean {
  return QR_REQUEST_RE.test(message.trim())
}
