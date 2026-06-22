function looksLikeLaneYaStructuredJson(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const o = value as Record<string, unknown>
  return (
    "phase" in o ||
    "triage" in o ||
    "patient_context" in o ||
    "recommendation" in o ||
    "safety_check" in o
  )
}

function tryParseStructuredJson(text: string): unknown | null {
  try {
    return JSON.parse(text.trim())
  } catch {
    return null
  }
}

const QR_HOLD_PHRASES = [
  /ถือ\s*QR[^\n]*/gi,
  /สแกน\s*QR[^\n]*/gi,
  /กำลังออก\s*QR[^\n]*/gi,
  /รับ\s*QR[^\n]*/gi,
  /hold\s+the\s+qr[^\n]*/gi,
]

/** Remove lines that promise a QR when no ticket was issued. */
export function stripQrHoldPhrases(text: string): string {
  let out = String(text ?? "")
  for (const re of QR_HOLD_PHRASES) {
    out = out.replace(re, "").trim()
  }
  return out.replace(/\n{3,}/g, "\n\n").trim()
}

function truncateAtStreamingJsonStart(text: string): string {
  const fenceJson = text.search(/\n```(?:json)?/i)
  if (fenceJson >= 0) return text.slice(0, fenceJson).trimEnd()

  const bareFence = text.search(/\n```[^\n]*\n\s*\{/)
  if (bareFence >= 0) return text.slice(0, bareFence).trimEnd()

  const lines = text.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line.startsWith("{")) continue
    const tail = lines.slice(i).join("\n")
    if (
      /"phase"|"triage"|"recommendation"|"patient_context"|"safety_check"/.test(
        tail
      )
    ) {
      return lines.slice(0, i).join("\n").trimEnd()
    }
  }

  const openFence = text.lastIndexOf("```")
  if (openFence >= 0) {
    const after = text.slice(openFence + 3)
    if (!after.includes("```")) {
      return text.slice(0, openFence).trimEnd()
    }
  }

  return text
}

/**
 * Dify returns Thai text plus a machine-readable JSON block (fenced or raw).
 * Chat bubbles should only show the human-facing part.
 */
export function stripPatientFacingAnswer(raw: string): string {
  let text = String(raw ?? "").trim()
  if (!text) return ""

  text = text
    .replace(/```(?:json)?\s*([\s\S]*?)```/gi, (match, inner: string) => {
      const parsed = tryParseStructuredJson(inner)
      if (parsed && looksLikeLaneYaStructuredJson(parsed)) return ""
      return match
    })
    .trim()

  const lines = text.split("\n")
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith("{")) continue
    const candidate = lines.slice(i).join("\n").trim()
    const parsed = tryParseStructuredJson(candidate)
    if (parsed && looksLikeLaneYaStructuredJson(parsed)) {
      const visible = lines.slice(0, i).join("\n").trim()
      return visible || text
    }
  }

  if (text.startsWith("{") && text.endsWith("}")) {
    const parsed = tryParseStructuredJson(text)
    if (parsed && looksLikeLaneYaStructuredJson(parsed)) {
      return ""
    }
  }

  return text
}

/** Like stripPatientFacingAnswer but hides incomplete JSON/fences during SSE stream. */
export function stripPatientFacingAnswerStreaming(raw: string): string {
  const truncated = truncateAtStreamingJsonStart(String(raw ?? ""))
  return stripPatientFacingAnswer(truncated)
}
