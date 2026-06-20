import type { User } from "@prisma/client"
import { ConsultationSeverity } from "@prisma/client"
import { prisma } from "./prisma.js"
import {
  inferSeverityFromAnswer,
  canIssueQrFromStructured,
  severityFromRiskLevel,
} from "./consultationSeverity.js"
import { sanitizeAssistantOutput } from "./chatGuardrails.js"
import { extractStructuredJsonBlock, normalizeRiskLevel } from "./difyStructured.js"
import { stripPatientFacingAnswer } from "./stripPatientFacingAnswer.js"
import { isValidSlotId } from "./slotMapping.js"
import { issuePickupTicket } from "../services/pickupTicket.service.js"
import {
  checkDrugSafety,
  findMentionedDrugs,
  parseAllergyKeywords,
} from "./safetyCheck.js"
import type { MissingFieldKey } from "./profileCompleteness.js"

type SafetyWarning = {
  drugId: string
  drugName: string
  matchedAllergies: string[]
  checkedIngredients: string[]
}

function buildSafetyBanner(warnings: SafetyWarning[]): string {
  if (warnings.length === 0) return ""
  const lines = warnings.map((w) => {
    const allergens = w.matchedAllergies.join(", ")
    return `- **${w.drugName}** — พบสารที่คุณเคยแพ้: _${allergens}_`
  })
  return [
    "> ⚠️ **ตรวจพบความเสี่ยงแพ้ยา (Auto SafetyCheck)**",
    ">",
    "> จากประวัติแพ้ยาที่คุณบันทึกไว้ ระบบพบว่าคำแนะนำนี้อาจมียาที่ไม่ควรใช้:",
    ...lines.map((l) => `> ${l}`),
    ">",
    "> โปรดหลีกเลี่ยงยาเหล่านี้และปรึกษาเภสัชกร/แพทย์ก่อนใช้",
    "",
    "---",
    "",
  ].join("\n")
}

export type ChatFinalizeResult = {
  answer: string
  sessionId: string
  conversationId: string | null
  riskLevel: string
  qrTicket: Awaited<ReturnType<typeof issuePickupTicket>> | null
  informationalAlternatives: string[]
  safetyCheck: {
    mentionedDrugIds: string[]
    warnings: SafetyWarning[]
    firstUnsafeDrugId: string | null
    qrGate: string
  }
  profile: {
    missingFields: MissingFieldKey[]
    missingCritical: MissingFieldKey[]
    askedInChat: boolean
    autoSavedFields: string[]
  }
}

export async function finalizeDifyAnswer(params: {
  rawDifyAnswer: string
  difyConversationId: string | null
  session: { id: string; difyConversationId: string | null; summary: string | null; recommendedDrugId: string | null }
  user: User
  missingFields: MissingFieldKey[]
  autoSavedFields: string[]
  summarySlice: string
}): Promise<ChatFinalizeResult> {
  const { rawDifyAnswer, session, user, missingFields, autoSavedFields, summarySlice } =
    params

  const patientAnswer = sanitizeAssistantOutput(
    stripPatientFacingAnswer(rawDifyAnswer)
  )
  const structured = extractStructuredJsonBlock(rawDifyAnswer)
  const riskLevel = normalizeRiskLevel(structured)

  const allDrugs = await prisma.drug.findMany({
    select: { id: true, name: true, ingredientsText: true },
  })
  const userAllergyKeywords = parseAllergyKeywords({
    noAllergies: user.noAllergies,
    allergyKeywords: user.allergyKeywords,
    allergiesText: user.allergiesText,
  })
  const mentioned = findMentionedDrugs(patientAnswer, allDrugs)
  const safetyWarnings: SafetyWarning[] = []
  let firstUnsafeDrugId: string | null = null
  for (const d of mentioned) {
    const result = checkDrugSafety({
      userAllergyKeywords,
      drugIngredientsText: d.ingredientsText,
    })
    if (!result.isSafe) {
      safetyWarnings.push({
        drugId: d.id,
        drugName: d.name,
        matchedAllergies: result.matchedAllergies,
        checkedIngredients: result.checkedIngredients,
      })
      if (!firstUnsafeDrugId) firstUnsafeDrugId = d.id
    }
  }

  const safetyBanner = buildSafetyBanner(safetyWarnings)
  const finalAnswer = safetyBanner + patientAnswer
  const severityInput =
    safetyWarnings.length > 0
      ? `${patientAnswer}\nแจ้งเตือนแพ้ยา: ${safetyWarnings
          .map((w) => w.drugName)
          .join(", ")}`
      : patientAnswer
  const { severity, reason } = inferSeverityFromAnswer(severityInput)
  const finalSeverity =
    severity === ConsultationSeverity.ESCALATE_HOSPITAL
      ? severity
      : severityFromRiskLevel(riskLevel)

  const qrGate = canIssueQrFromStructured(structured, {
    missingFieldsEmpty: missingFields.length === 0,
    hasSafetyWarnings: safetyWarnings.length > 0,
    inferredSeverity: finalSeverity,
  })

  const assistantMessage = await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: "assistant",
      content: finalAnswer,
    },
  })

  let qrTicket: Awaited<ReturnType<typeof issuePickupTicket>> | null = null
  if (qrGate.ok && structured?.recommendation?.drug_slot_id) {
    const slotKey = structured.recommendation.drug_slot_id.toUpperCase()
    if (isValidSlotId(slotKey)) {
      const drug = await prisma.drug.findFirst({
        where: { slotId: slotKey, quantity: { gt: 0 } },
      })
      if (drug) {
        const drugSafety = checkDrugSafety({
          userAllergyKeywords,
          drugIngredientsText: drug.ingredientsText,
        })
        if (drugSafety.isSafe) {
          try {
            qrTicket = await issuePickupTicket({
              sessionId: session.id,
              messageId: assistantMessage.id,
              drugId: drug.id,
              slotId: slotKey,
              quantity: structured.recommendation.quantity ?? 1,
              riskLevel: qrGate.riskLevel,
            })
          } catch (e) {
            console.warn("issuePickupTicket failed:", e)
          }
        }
      }
    }
  }

  const conversationId =
    params.difyConversationId || session.difyConversationId

  await prisma.chatSession.update({
    where: { id: session.id },
    data: {
      difyConversationId: conversationId,
      summary: session.summary ?? summarySlice,
      severity: finalSeverity,
      redFlagReason:
        reason ??
        (safetyWarnings.length > 0
          ? `SafetyCheck: ${safetyWarnings.map((w) => w.drugName).join(", ")}`
          : null),
      recommendedDrugId:
        qrTicket?.drugId ??
        session.recommendedDrugId ??
        (mentioned[0]?.id ?? null),
    },
  })

  return {
    answer: finalAnswer,
    sessionId: session.id,
    conversationId,
    riskLevel,
    qrTicket,
    informationalAlternatives:
      structured?.safety_check?.informational_alternatives ?? [],
    safetyCheck: {
      mentionedDrugIds: mentioned.map((m) => m.id),
      warnings: safetyWarnings,
      firstUnsafeDrugId,
      qrGate: qrGate.ok ? "approved" : qrGate.reason ?? "denied",
    },
    profile: {
      missingFields,
      missingCritical: [] as MissingFieldKey[],
      askedInChat: false,
      autoSavedFields,
    },
  }
}
