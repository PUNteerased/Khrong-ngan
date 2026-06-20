import { ConsultationSeverity } from "@prisma/client"
import type { DifyRiskLevel, DifyStructuredPayload } from "./difyStructured.js"
import { normalizeRiskLevel } from "./difyStructured.js"

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

export function severityFromRiskLevel(risk: DifyRiskLevel): ConsultationSeverity {
  if (risk === "ESCALATE") return ConsultationSeverity.ESCALATE_HOSPITAL
  return ConsultationSeverity.ROUTINE
}

export function canIssueQrFromStructured(
  structured: DifyStructuredPayload | null,
  opts: {
    missingFieldsEmpty: boolean
    hasSafetyWarnings: boolean
    inferredSeverity: ConsultationSeverity
  }
): { ok: boolean; reason?: string; riskLevel: DifyRiskLevel } {
  const riskLevel = normalizeRiskLevel(structured)

  if (!opts.missingFieldsEmpty) {
    return { ok: false, reason: "profile_incomplete", riskLevel }
  }
  if (opts.inferredSeverity === ConsultationSeverity.ESCALATE_HOSPITAL) {
    return { ok: false, reason: "escalate_hospital", riskLevel }
  }
  if (riskLevel === "ESCALATE" || riskLevel === "HIGH") {
    return { ok: false, reason: "risk_too_high", riskLevel }
  }
  if (structured?.next_action !== "dispense_qr") {
    return { ok: false, reason: "next_action_not_dispense", riskLevel }
  }
  if (structured?.safety_check?.safe_to_dispense !== true) {
    return { ok: false, reason: "not_safe_to_dispense", riskLevel }
  }
  if (structured?.safety_check?.allergy_conflict === true) {
    return { ok: false, reason: "allergy_conflict", riskLevel }
  }
  if (opts.hasSafetyWarnings) {
    return { ok: false, reason: "backend_allergy_warning", riskLevel }
  }
  if (!structured?.recommendation?.drug_slot_id) {
    return { ok: false, reason: "no_slot_id", riskLevel }
  }

  return { ok: true, riskLevel }
}
