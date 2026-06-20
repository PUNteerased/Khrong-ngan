export type DifyRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "ESCALATE"

export type DifyStructuredPayload = {
  phase?: string
  triage?: {
    severity?: string
    risk_level?: string
    chief_complaint?: string
  }
  recommendation?: {
    drug_slot_id?: string | null
    drug_name?: string | null
    quantity?: number
    rationale?: string
  }
  safety_check?: {
    safe_to_dispense?: boolean
    allergy_conflict?: boolean
    notes?: string
    informational_alternatives?: string[]
  }
  next_action?: "dispense_qr" | "ask_followup" | "refer_hospital"
}

export function extractStructuredJsonBlock(raw: string): DifyStructuredPayload | null {
  const text = String(raw ?? "").trim()
  if (!text) return null

  const fenced = text.match(/```json\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim()) as DifyStructuredPayload
    } catch {
      return null
    }
  }

  const lines = text.split("\n")
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith("{")) continue
    const candidate = lines.slice(i).join("\n").trim()
    try {
      return JSON.parse(candidate) as DifyStructuredPayload
    } catch {
      continue
    }
  }

  if (text.startsWith("{") && text.endsWith("}")) {
    try {
      return JSON.parse(text) as DifyStructuredPayload
    } catch {
      return null
    }
  }

  return null
}

export function normalizeRiskLevel(
  structured: DifyStructuredPayload | null
): DifyRiskLevel {
  const raw =
    structured?.triage?.risk_level?.toUpperCase() ??
    structured?.triage?.severity?.toUpperCase() ??
    "LOW"
  if (raw === "ESCALATE" || raw === "ESCALATE_HOSPITAL") return "ESCALATE"
  if (raw === "HIGH") return "HIGH"
  if (raw === "MEDIUM") return "MEDIUM"
  return "LOW"
}
