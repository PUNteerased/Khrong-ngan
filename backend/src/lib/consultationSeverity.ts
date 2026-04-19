import { ConsultationSeverity } from "@prisma/client"

const ESCALATION_PATTERNS = [
  /โรงพยาบาล/,
  /ร\.พ\.|รพ\./,
  /ฉุกเฉิน/,
  /1669/,
  /พบแพทย์/,
  /ไปโรงพยาบาล/,
  /hospital/i,
  /\bER\b/,
  /emergency/i,
  /call\s*911/i,
  /see\s+a\s+doctor/i,
  /seek\s+medical/i,
]

/**
 * Infer escalation from assistant text when Dify does not return structured metadata.
 */
export function inferSeverityFromAnswer(answer: string): {
  severity: ConsultationSeverity
  reason: string | null
} {
  const text = answer.trim()
  if (!text) return { severity: ConsultationSeverity.ROUTINE, reason: null }
  for (const re of ESCALATION_PATTERNS) {
    if (re.test(text)) {
      return {
        severity: ConsultationSeverity.ESCALATE_HOSPITAL,
        reason: "keyword_match",
      }
    }
  }
  return { severity: ConsultationSeverity.ROUTINE, reason: null }
}
