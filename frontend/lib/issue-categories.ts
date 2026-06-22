export const ISSUE_MAIN_CATEGORIES = [
  "medical_logic",
  "technical_bug",
  "feedback",
  "kiosk",
] as const

export type IssueMainCategory = (typeof ISSUE_MAIN_CATEGORIES)[number]

export const ISSUE_SUB_CATEGORIES: Record<
  IssueMainCategory,
  readonly { value: string; labelKey: string }[]
> = {
  medical_logic: [
    { value: "unsafe_age_allergy", labelKey: "subMedicalUnsafeAge" },
    { value: "wrong_drug_info", labelKey: "subMedicalWrongDrug" },
    { value: "off_topic_thai", labelKey: "subMedicalOffTopic" },
    { value: "other", labelKey: "subOther" },
  ],
  technical_bug: [
    { value: "chat_stuck", labelKey: "subTechChatStuck" },
    { value: "mobile_layout", labelKey: "subTechMobileLayout" },
    { value: "slow_timeout", labelKey: "subTechSlow" },
    { value: "other", labelKey: "subOther" },
  ],
  feedback: [
    { value: "new_feature", labelKey: "subFeedbackFeature" },
    { value: "more_drugs", labelKey: "subFeedbackDrugs" },
    { value: "other", labelKey: "subOther" },
  ],
  kiosk: [
    { value: "qr_not_scanning", labelKey: "subKioskQr" },
    { value: "camera_offline", labelKey: "subKioskCamera" },
    { value: "code_not_working", labelKey: "subKioskCode" },
    { value: "dispense_failed", labelKey: "subKioskDispense" },
    { value: "screen_frozen", labelKey: "subKioskFrozen" },
    { value: "wrong_medicine", labelKey: "subKioskWrongMed" },
    { value: "other", labelKey: "subOther" },
  ],
}

export function buildIssueCategory(
  main: string,
  sub: string,
  subOther?: string
): string {
  if (sub === "other" && subOther?.trim()) {
    return `${main}:other:${subOther.trim()}`
  }
  return `${main}:${sub}`
}
