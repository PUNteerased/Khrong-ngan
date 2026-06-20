const JAILBREAK_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /forget\s+(your|the)\s+(rules|instructions|prompt)/i,
  /you\s+are\s+now\s+/i,
  /act\s+as\s+(?!.*เภสัช)/i,
  /pretend\s+(you|to)\s+/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /developer\s+mode/i,
  /system\s+prompt/i,
  /เปลี่ยนบุคลิก/i,
  /ลืม(?:คำสั่ง|กฎ)/i,
  /ไม่ต้อง(?:เป็น|ทำ).*เภสัช/i,
  /hack|แฮก/i,
]

const REFUSAL_REPLY =
  "ขออภัยครับ/ค่ะ LaneYa เป็นเภสัชกร AI ช่วยประเมินอาการและแนะนำยา OTC อย่างปลอดภัยเท่านั้น ไม่สามารถทำตามคำสั่งที่ขัดกับกฎความปลอดภัยหรือเปลี่ยนบทบาทได้ กรุณาเล่าอาการหรือความต้องการด้านยาให้ฟังนะครับ/ค่ะ 🙏"

export function isJailbreakAttempt(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  return JAILBREAK_PATTERNS.some((re) => re.test(text))
}

export function jailbreakRefusalReply(): string {
  return REFUSAL_REPLY
}

import { stripPatientFacingAnswer } from "./stripPatientFacingAnswer.js"

export function sanitizeAssistantOutput(text: string): string {
  return stripPatientFacingAnswer(text)
    .replace(/\b(fuck|shit|damn)\b/gi, "—")
    .trim()
}

export const RISK_RUBRIC_INPUT = `
Risk levels (emit in JSON triage.risk_level):
- LOW: mild OTC, no red flags, profile complete
- MEDIUM: needs caution (elderly, polypharmacy, borderline symptoms)
- HIGH: should see pharmacist/doctor soon; do NOT dispense_qr
- ESCALATE: emergency / red flags → refer_hospital only
`.trim()

export const OFF_KIOSK_EXAMPLES_INPUT = `
Off-kiosk suggestions (informational only):
- Name the drug in Thai, state "ไม่มีในตู้นี้ ต้องไปซื้อที่ร้านยา"
- Never set next_action=dispense_qr for off-kiosk drugs
- Example: antihistamine not stocked → suggest cetirizine at pharmacy, dispense_qr only if loratadine in inventory and safe
`.trim()
