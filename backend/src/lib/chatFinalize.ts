import type { User, ChatSession } from "@prisma/client"
import { ConsultationSeverity } from "@prisma/client"
import { prisma } from "./prisma.js"
import {
  inferSeverityFromAnswer,
  canIssueQrFromStructured,
  severityFromRiskLevel,
} from "./consultationSeverity.js"
import { sanitizeAssistantOutput } from "./chatGuardrails.js"
import { extractStructuredJsonBlock, normalizeRiskLevel } from "./difyStructured.js"
import {
  stripPatientFacingAnswer,
  stripQrHoldPhrases,
} from "./stripPatientFacingAnswer.js"
import { extractSlotFromText } from "./qrSlotExtract.js"
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

async function issueQrForSlot(params: {
  sessionId: string
  messageId: string
  slotKey: string
  quantity: number
  riskLevel: string
  userAllergyKeywords: string[]
}): Promise<Awaited<ReturnType<typeof issuePickupTicket>> | null> {
  if (!isValidSlotId(params.slotKey)) return null
  const drug = await prisma.drug.findFirst({
    where: { slotId: params.slotKey, quantity: { gt: 0 } },
  })
  if (!drug) return null
  const drugSafety = checkDrugSafety({
    userAllergyKeywords: params.userAllergyKeywords,
    drugIngredientsText: drug.ingredientsText,
  })
  if (!drugSafety.isSafe) return null
  try {
    return await issuePickupTicket({
      sessionId: params.sessionId,
      messageId: params.messageId,
      drugId: drug.id,
      slotId: params.slotKey,
      quantity: params.quantity,
      riskLevel: params.riskLevel as "LOW" | "MEDIUM" | "HIGH" | "ESCALATE",
    })
  } catch (e) {
    console.warn("issuePickupTicket failed:", e)
    return null
  }
}

/** Fast-path: user asks for QR and session already has a recommended drug. */
export async function finalizeQrRequest(params: {
  session: ChatSession
  user: User
  missingFields: MissingFieldKey[]
  autoSavedFields: string[]
}): Promise<ChatFinalizeResult | null> {
  const { session, user, missingFields, autoSavedFields } = params
  if (missingFields.length > 0 || !session.recommendedDrugId) return null

  const drug = await prisma.drug.findFirst({
    where: { id: session.recommendedDrugId, quantity: { gt: 0 } },
  })
  if (!drug) return null

  const userAllergyKeywords = parseAllergyKeywords({
    noAllergies: user.noAllergies,
    allergyKeywords: user.allergyKeywords,
    allergiesText: user.allergiesText,
  })
  const drugSafety = checkDrugSafety({
    userAllergyKeywords,
    drugIngredientsText: drug.ingredientsText,
  })
  if (!drugSafety.isSafe) return null

  const answer =
    `ได้เลยครับ/ค่ะ 🙏 นี่คือ QR สำหรับรับ **${drug.name} (ช่อง ${drug.slotId})** ที่ตู้จ่ายยานะครับ/ค่ะ\n\n` +
    `ถือ QR บนหน้าจอให้กล้องที่ตู้เพื่อรับยาได้เลยครับ/ค่ะ 📱`

  const assistantMessage = await prisma.chatMessage.create({
    data: { sessionId: session.id, role: "assistant", content: answer },
  })

  const qrTicket = await issueQrForSlot({
    sessionId: session.id,
    messageId: assistantMessage.id,
    slotKey: drug.slotId.toUpperCase(),
    quantity: 1,
    riskLevel: "LOW",
    userAllergyKeywords,
  })

  if (!qrTicket) return null

  return {
    answer,
    sessionId: session.id,
    conversationId: session.difyConversationId,
    riskLevel: "LOW",
    qrTicket,
    informationalAlternatives: [],
    safetyCheck: {
      mentionedDrugIds: [drug.id],
      warnings: [],
      firstUnsafeDrugId: null,
      qrGate: "approved",
    },
    profile: {
      missingFields,
      missingCritical: [] as MissingFieldKey[],
      askedInChat: false,
      autoSavedFields,
    },
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

  const structured = extractStructuredJsonBlock(rawDifyAnswer)
  const riskLevel = normalizeRiskLevel(structured)
  const fallbackSlot = extractSlotFromText(rawDifyAnswer)

  let patientAnswer = sanitizeAssistantOutput(
    stripPatientFacingAnswer(rawDifyAnswer)
  )

  const allDrugs = await prisma.drug.findMany({
    select: { id: true, name: true, ingredientsText: true, slotId: true },
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
    fallbackSlotId: fallbackSlot,
  })

  const assistantMessage = await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: "assistant",
      content: patientAnswer,
    },
  })

  let qrTicket: Awaited<ReturnType<typeof issuePickupTicket>> | null = null
  if (qrGate.ok && qrGate.slotId) {
    qrTicket = await issueQrForSlot({
      sessionId: session.id,
      messageId: assistantMessage.id,
      slotKey: qrGate.slotId,
      quantity: structured?.recommendation?.quantity ?? 1,
      riskLevel: qrGate.riskLevel,
      userAllergyKeywords,
    })
  }

  if (!qrTicket) {
    patientAnswer = stripQrHoldPhrases(patientAnswer)
  }

  const safetyBanner = buildSafetyBanner(safetyWarnings)
  const finalAnswer = safetyBanner + patientAnswer

  if (assistantMessage.content !== finalAnswer) {
    await prisma.chatMessage.update({
      where: { id: assistantMessage.id },
      data: { content: finalAnswer },
    })
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
