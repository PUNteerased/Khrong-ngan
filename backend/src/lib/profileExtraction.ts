/**
 * Free-text profile extractor.
 *
 * Scans a single chat message (Thai / English) and, for each profile field
 * that is still `missing`, tries to pull a confident value out of the user's
 * answer. We deliberately only run over missing fields so that we never
 * overwrite something the user already entered in their profile form.
 *
 * This is intentionally regex-based (not LLM-based) so it is deterministic,
 * cheap, and easy to reason about.
 */

import type { MissingFieldKey } from "./profileCompleteness.js"

export type ExtractedProfile = {
  age?: number
  weight?: number
  height?: number
  gender?: "male" | "female" | "other"
  allergiesText?: string
  noAllergies?: boolean
  diseasesText?: string
  noDiseases?: boolean
  currentMedications?: string
}

/**
 * Extract any profile fields that appear in `message`. Only extracts for
 * fields the caller says are still missing.
 */
export function extractProfileFromMessage(
  message: string,
  missing: MissingFieldKey[]
): ExtractedProfile {
  const raw = (message ?? "").trim()
  if (!raw || missing.length === 0) return {}
  const text = raw.toLowerCase()
  const out: ExtractedProfile = {}
  const wants = (k: MissingFieldKey) => missing.includes(k)

  // ---- AGE ---------------------------------------------------------------
  if (wants("age")) {
    const m =
      text.match(/(?:อายุ|age(?:d)?|i['\s]?m)\s*(\d{1,3})/) ||
      text.match(/(\d{1,3})\s*(?:ปี|yrs?|years?|yo|y\.?o\.?)\b/)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n >= 1 && n <= 120) out.age = n
    }
  }

  // ---- WEIGHT ------------------------------------------------------------
  if (wants("weight")) {
    const m =
      text.match(/(?:น้ำหนัก|weight)\s*(\d{1,3}(?:\.\d+)?)/) ||
      text.match(
        /(\d{1,3}(?:\.\d+)?)\s*(?:กก\.?|kg|กิโลกรัม|กิโล(?!เมตร))/
      )
    if (m) {
      const n = parseFloat(m[1])
      if (n >= 2 && n <= 400) out.weight = n
    }
  }

  // ---- HEIGHT ------------------------------------------------------------
  if (wants("height")) {
    const m =
      text.match(/(?:ส่วนสูง|สูง|height|tall)\s*(\d{2,3}(?:\.\d+)?)/) ||
      text.match(
        /(\d{2,3}(?:\.\d+)?)\s*(?:ซม\.?|cm|เซนติเมตร|เซ็นติเมตร|เซน)/
      )
    if (m) {
      const n = parseFloat(m[1])
      if (n >= 40 && n <= 260) out.height = n
    }
  }

  // ---- GENDER ------------------------------------------------------------
  // Check "other" and female *before* "male" so that "ผู้หญิง" / "female"
  // are matched first (a naive "ชาย" test would otherwise steal them via
  // substring). Thai keywords can't use \b (word boundary is ASCII-only),
  // so we just search substrings for Thai and use \b for English.
  if (wants("gender")) {
    if (
      /เพศทางเลือก|เพศอื่น|non[-\s]?binary|lgbtq?|อื่น ?ๆ/.test(text)
    ) {
      out.gender = "other"
    } else if (
      /ผู้หญิง|เพศหญิง|เป็นหญิง|เพศ:?\s*หญิง/.test(text) ||
      /\b(female|woman|girl)\b/.test(text)
    ) {
      out.gender = "female"
    } else if (
      /ผู้ชาย|เพศชาย|เป็นชาย|เพศ:?\s*ชาย/.test(text) ||
      /\b(male|man|boy)\b/.test(text)
    ) {
      out.gender = "male"
    }
  }

  // ---- ALLERGIES ---------------------------------------------------------
  if (wants("allergies")) {
    if (
      /(ไม่แพ้ยา|ไม่เคยแพ้|ไม่มีประวัติแพ้|ไม่มีแพ้|no (drug )?allergy|no allergies|not allergic)/.test(
        text
      )
    ) {
      out.noAllergies = true
      out.allergiesText = ""
    } else {
      // NB: Thai rarely uses whitespace between words, so allow `\s*` after
      // the trigger ("แพ้ยาพาราเซตามอลครับ" → "พาราเซตามอล").
      const m = raw.match(
        /(?:แพ้ยา|แพ้|allergic to)\s*([^\n.!?]+?)(?:\s*ครับ|\s*ค่ะ|[.!?]|$)/i
      )
      if (m) {
        const val = m[1].trim().replace(/[,;:\s]+$/, "")
        if (val.length >= 2 && val.length <= 200) {
          out.allergiesText = val
          out.noAllergies = false
        }
      }
    }
  }

  // ---- DISEASES ----------------------------------------------------------
  if (wants("diseases")) {
    if (
      /(ไม่มีโรค|ไม่มีโรคประจำตัว|ไม่ป่วย|สุขภาพดี|no (chronic|underlying) (condition|disease)|no medical history)/.test(
        text
      )
    ) {
      out.noDiseases = true
      out.diseasesText = ""
    } else {
      const m = raw.match(
        /(?:มีโรค|โรคประจำตัว(?:คือ)?|เป็นโรค|ป่วยเป็น|suffer(?:ing)? from|diagnosed with)\s*(?:โรค)?\s*([^\n.!?]+?)(?:\s*ครับ|\s*ค่ะ|[.!?]|$)/i
      )
      if (m) {
        const val = m[1].trim().replace(/[,;:\s]+$/, "")
        if (val.length >= 2 && val.length <= 200) {
          out.diseasesText = val
          out.noDiseases = false
        }
      }
    }
  }

  // ---- CURRENT MEDICATIONS ----------------------------------------------
  if (wants("currentMedications")) {
    if (
      /(ไม่ได้ทานยา|ไม่ได้กินยา|ไม่มียา(ประจำ|ที่ทาน)?|ไม่ทานยา(ประจำ|อะไร)?|no (current )?medication|not taking any (medication|drug))/.test(
        text
      )
    ) {
      out.currentMedications = "ไม่มี"
    } else {
      // Allow no-space trigger for Thai: "ทานยาเบาหวานประจำ"
      const m = raw.match(
        /(?:ทานยา|กินยา|ใช้ยา|taking|currently on|on)\s*([^\n.!?]+?)(?:\s*อยู่ประจำ|\s*ประจำ|\s*อยู่|\s*daily|\s*regularly|\s*ครับ|\s*ค่ะ|[.!?]|$)/i
      )
      if (m) {
        const val = m[1].trim().replace(/[,;:\s]+$/, "")
        if (val.length >= 2 && val.length <= 200) {
          out.currentMedications = val
        }
      }
    }
  }

  return out
}

/** Returns true if any field was extracted. Handy for branching. */
export function hasAnyExtracted(e: ExtractedProfile): boolean {
  return Object.keys(e).length > 0
}
