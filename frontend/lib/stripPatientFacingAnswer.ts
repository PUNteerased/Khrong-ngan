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

/** Strip Dify structured JSON from assistant messages before rendering. */
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
