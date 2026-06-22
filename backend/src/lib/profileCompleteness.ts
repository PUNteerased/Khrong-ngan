/**
 * Utilities that let the chat pipeline tell the AI which medical-profile
 * fields are still missing, so the AI can proactively ask the patient to
 * fill them *inside the chat* before triaging.
 */

export type ProfileSource = {
  age: number | null
  weight: number | null
  height: number | null
  gender: string | null
  allergiesText: string
  noAllergies: boolean
  diseasesText: string
  noDiseases: boolean
  currentMedications: string
}

export type MissingFieldKey =
  | "age"
  | "weight"
  | "height"
  | "gender"
  | "allergies"
  | "diseases"
  | "currentMedications"

/** Max profile questions the AI should ask per chat turn. */
export const MAX_ASK_PER_TURN = 2

/** Thai one-liners the AI can echo when asking the patient. */
export const MISSING_FIELD_PROMPTS: Record<MissingFieldKey, string> = {
  age: "อายุเท่าไหร่ครับ (ปี)",
  weight: "น้ำหนักประมาณเท่าไหร่ครับ (กก.)",
  height: "ส่วนสูงประมาณเท่าไหร่ครับ (ซม.)",
  gender: "เพศชายหรือหญิงครับ",
  allergies: "เคยแพ้ยาอะไรบ้างครับ ถ้าไม่มีบอก 'ไม่มี' ได้เลย",
  diseases:
    "มีโรคประจำตัวไหมครับ เช่น เบาหวาน ความดัน ถ้าไม่มีบอก 'ไม่มี' ได้เลย",
  currentMedications:
    "ตอนนี้ทานยาประจำอะไรอยู่ไหมครับ ถ้าไม่มีบอก 'ไม่มี' ได้เลย",
}

const LABELS: Record<MissingFieldKey, string> = {
  age: "อายุ",
  weight: "น้ำหนัก (กก.)",
  height: "ส่วนสูง (ซม.)",
  gender: "เพศ",
  allergies: "ประวัติแพ้ยา",
  diseases: "โรคประจำตัว",
  currentMedications: "ยาที่ทานอยู่ประจำ",
}

/** Returns the list of fields that are still unknown for this user. */
export function detectMissingProfileFields(
  user: ProfileSource
): MissingFieldKey[] {
  const missing: MissingFieldKey[] = []
  if (user.age == null) missing.push("age")
  if (user.weight == null) missing.push("weight")
  if (user.height == null) missing.push("height")
  if (!user.gender || !user.gender.trim()) missing.push("gender")
  if (!user.noAllergies && !user.allergiesText.trim()) missing.push("allergies")
  if (!user.noDiseases && !user.diseasesText.trim()) missing.push("diseases")
  if (!user.currentMedications.trim()) missing.push("currentMedications")
  return missing
}

/** First N missing fields to ask this turn. */
export function fieldsToAskThisTurn(
  missing: MissingFieldKey[],
  max = MAX_ASK_PER_TURN
): MissingFieldKey[] {
  return missing.slice(0, max)
}

/**
 * Builds a Thai instruction block for Dify — only the fields to ask now (max 2).
 */
export function buildMissingFieldsInstruction(
  missing: MissingFieldKey[]
): string {
  if (missing.length === 0) {
    return "ข้อมูลผู้ใช้ครบถ้วน สามารถประเมินอาการและแนะนำยาต่อได้เลย"
  }

  const askNow = fieldsToAskThisTurn(missing)
  const bullets = askNow
    .map((k) => `- ${LABELS[k]}: ${MISSING_FIELD_PROMPTS[k]}`)
    .join("\n")

  const remaining = missing.length - askNow.length
  const remainingNote =
    remaining > 0
      ? `\n(ยังขาดอีก ${remaining} ข้อ — ถามในเทิร์นถัดไปหลังผู้ใช้ตอบ)`
      : ""

  return [
    "ข้อมูลโปรไฟล์ยังไม่ครบ — ถามเฉพาะข้อด้านล่างนี้ในเทิร์นนี้ (สูงสุด 2 ข้อ):",
    bullets,
    remainingNote,
    "ใช้โทนเภสัชชาย อบอุ่น สั้น (ครับ/นะครับ) ห้ามถามเกิน 2 ข้อ ห้ามใช้เลข 1) 2) 3) ยาว",
    "อย่าแนะนำยาจนกว่าข้อมูลจะครบ",
  ].join("\n")
}
