const ISSUE_MAIN_CATEGORIES = new Set([
  "medical_logic",
  "technical_bug",
  "feedback",
  "kiosk",
])

const ISSUE_SUB_CATEGORIES: Record<string, Set<string>> = {
  medical_logic: new Set([
    "unsafe_age_allergy",
    "wrong_drug_info",
    "off_topic_thai",
    "other",
  ]),
  technical_bug: new Set(["chat_stuck", "mobile_layout", "slow_timeout", "other"]),
  feedback: new Set(["new_feature", "more_drugs", "other"]),
  kiosk: new Set([
    "qr_not_scanning",
    "camera_offline",
    "code_not_working",
    "dispense_failed",
    "screen_frozen",
    "wrong_medicine",
    "other",
  ]),
}

export function normalizeIssueCategory(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null

  if (!value.includes(":")) return null

  const [main, sub, ...rest] = value.split(":")
  if (!main || !sub || !ISSUE_MAIN_CATEGORIES.has(main)) return null
  if (!ISSUE_SUB_CATEGORIES[main]?.has(sub)) return null

  if (sub === "other") {
    const detail = rest.join(":").trim()
    if (!detail) return null
    return `${main}:other:${detail.slice(0, 120)}`
  }

  if (rest.length > 0) return null
  return `${main}:${sub}`
}

export function resolveIssueCategory(body: {
  category?: string
  subCategory?: string
  subCategoryOther?: string
}): string | null {
  const raw = String(body.category || "").trim()
  const sub = String(body.subCategory || "").trim()
  const subOther = String(body.subCategoryOther || "").trim()

  if (raw.includes(":")) {
    return normalizeIssueCategory(raw)
  }

  if (!raw || !sub) return null

  const combined =
    sub === "other" && subOther
      ? `${raw}:other:${subOther}`
      : `${raw}:${sub}`

  return normalizeIssueCategory(combined)
}
