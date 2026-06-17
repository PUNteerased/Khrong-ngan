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

/** Thai one-liners the AI can echo verbatim when asking the patient. */
export const MISSING_FIELD_PROMPTS: Record<MissingFieldKey, string> = {
  age: "ขอทราบอายุของคุณ (เป็นปี) เพื่อประเมินยาให้ปลอดภัยครับ/ค่ะ",
  weight:
    "ขอทราบน้ำหนักตัวโดยประมาณ (กก.) เพื่อคำนวณขนาดยาที่เหมาะสมครับ/ค่ะ",
  height:
    "ขอทราบส่วนสูงของคุณ (ซม.) เพื่อประกอบการประเมินขนาดยาครับ/ค่ะ",
  gender:
    "ขอทราบเพศของคุณ (ชาย / หญิง / อื่น ๆ) เพื่อให้คำแนะนำได้ปลอดภัยขึ้นครับ/ค่ะ",
  allergies:
    "คุณเคยแพ้ยาอะไรบ้างครับ/ค่ะ? ถ้าไม่เคยแพ้ยาเลย โปรดบอกว่า 'ไม่มี' ได้เลยครับ/ค่ะ",
  diseases:
    "คุณมีโรคประจำตัวอะไรบ้างไหมครับ/ค่ะ เช่น เบาหวาน ความดัน หอบหืด โรคไต โรคตับ ถ้าไม่มีให้บอกว่า 'ไม่มี' ได้เลย",
  currentMedications:
    "ตอนนี้คุณทานยาอะไรประจำอยู่บ้างไหมครับ/ค่ะ? (ถ้าไม่มีบอก 'ไม่มี' ได้เลย) — เพื่อตรวจสอบยาตีกัน",
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

/**
 * Builds a single Thai instruction block to inject into the Dify prompt so
 * the AI knows exactly which questions to ask (and in what words).
 */
export function buildMissingFieldsInstruction(
  missing: MissingFieldKey[]
): string {
  if (missing.length === 0) {
    return "ข้อมูลผู้ใช้ครบถ้วน สามารถประเมินอาการและแนะนำยาต่อได้เลย"
  }
  const bullets = missing
    .map((k, i) => `${i + 1}) ${LABELS[k]} — ${MISSING_FIELD_PROMPTS[k]}`)
    .join("\n")
  return [
    "ข้อมูลโปรไฟล์ผู้ใช้ยังไม่ครบ ระบบต้องการให้คุณถามข้อมูลต่อไปนี้ในแชตก่อนเริ่มวินิจฉัยหรือแนะนำยา:",
    bullets,
    "กรุณาถามเฉพาะข้อที่ยังขาด เรียงลำดับจากบนลงล่าง ใช้ภาษาสุภาพเป็นกันเอง และอย่าเพิ่งแนะนำยาจนกว่าข้อมูลจะครบ",
  ].join("\n")
}
