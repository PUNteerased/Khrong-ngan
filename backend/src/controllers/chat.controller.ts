import type { Request, Response } from "express"
import type { Prisma } from "@prisma/client"
import { ConsultationSeverity } from "@prisma/client"
import { prisma } from "../lib/prisma.js"
import { sendDifyChatMessage } from "../services/dify.service.js"
import { inferSeverityFromAnswer, canIssueQrFromStructured, severityFromRiskLevel } from "../lib/consultationSeverity.js"
import {
  isJailbreakAttempt,
  jailbreakRefusalReply,
  sanitizeAssistantOutput,
  RISK_RUBRIC_INPUT,
  OFF_KIOSK_EXAMPLES_INPUT,
} from "../lib/chatGuardrails.js"
import { extractStructuredJsonBlock, normalizeRiskLevel } from "../lib/difyStructured.js"
import { stripPatientFacingAnswer } from "../lib/stripPatientFacingAnswer.js"
import { isValidSlotId } from "../lib/slotMapping.js"
import { issuePickupTicket } from "../services/pickupTicket.service.js"
import {
  checkDrugSafety,
  findMentionedDrugs,
  parseAllergyKeywords,
} from "../lib/safetyCheck.js"
import {
  MISSING_FIELD_PROMPTS,
  buildMissingFieldsInstruction,
  detectMissingProfileFields,
  type MissingFieldKey,
} from "../lib/profileCompleteness.js"
import {
  extractProfileFromMessage,
  hasAnyExtracted,
  type ExtractedProfile,
} from "../lib/profileExtraction.js"

type SafetyWarning = {
  drugId: string
  drugName: string
  matchedAllergies: string[]
  checkedIngredients: string[]
}

const CRITICAL_FIELDS: MissingFieldKey[] = [
  "age",
  "weight",
  "height",
  "allergies",
]

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

function buildUserSnapshot(user: {
  fullName: string
  username: string
  phone: string | null
  age: number | null
  weight: number | null
  height: number | null
  gender: string | null
  allergiesText: string
  allergyKeywords: string
  noAllergies: boolean
  diseasesText: string
  noDiseases: boolean
  currentMedications: string
}): Prisma.InputJsonValue {
  return {
    fullName: user.fullName,
    username: user.username,
    phone: user.phone,
    age: user.age,
    weight: user.weight,
    height: user.height,
    gender: user.gender,
    allergiesText: user.allergiesText,
    allergyKeywords: user.allergyKeywords,
    noAllergies: user.noAllergies,
    diseasesText: user.diseasesText,
    noDiseases: user.noDiseases,
    currentMedications: user.currentMedications,
    capturedAt: new Date().toISOString(),
  }
}

/**
 * Build a compact markdown list of drugs currently in stock, which we inject
 * into Dify as the `inventory_drugs` input variable. Dify uses it as the
 * authoritative source of what the kiosk can physically dispense.
 *
 * Format (one line per drug): `- <slot> | <name> | stock: <qty> | category: <cat> | ingredients: <ings>`
 */
async function buildInventoryDrugsInput(): Promise<string> {
  const drugs = await prisma.drug.findMany({
    where: { quantity: { gt: 0 } },
    orderBy: { slotId: "asc" },
    select: {
      slotId: true,
      name: true,
      quantity: true,
      ingredientsText: true,
      category: true,
    },
  })
  if (drugs.length === 0) return "ไม่มียาในตู้ขณะนี้"
  return drugs
    .map((d) => {
      const ing = d.ingredientsText.trim() || "-"
      const cat = d.category?.trim() || "-"
      return `- ${d.slotId} | ${d.name} | stock: ${d.quantity} | category: ${cat} | ingredients: ${ing}`
    })
    .join("\n")
}

/**
 * Build a short Thai reply that asks the patient for the missing profile
 * fields directly in the chat. Used as a fast-path (no Dify round-trip)
 * whenever critical data is still unknown.
 */
function buildAskMissingReply(missing: MissingFieldKey[]): string {
  const header =
    "👋 สวัสดีครับ/ค่ะ ก่อนที่จะช่วยประเมินอาการและแนะนำยาให้ปลอดภัย ขอข้อมูลเพิ่มเติมอีกนิดนะครับ/ค่ะ:"
  const bullets = missing.map((k) => `• ${MISSING_FIELD_PROMPTS[k]}`)
  const footer =
    "\nเมื่อได้ข้อมูลครบแล้วระบบจะวิเคราะห์อาการและเลือกยาที่เหมาะสมให้ครับ/ค่ะ 🙏"
  return [header, "", ...bullets, footer].join("\n")
}

export async function postChat(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "ต้องเข้าสู่ระบบเพื่อแชท" })
    return
  }

  const { userMessage, sessionId, imageUrl } = req.body as {
    userMessage?: string
    sessionId?: string | null
    imageUrl?: string | null
  }

  const trimmedMessage = String(userMessage ?? "").trim()
  const trimmedImage = imageUrl ? String(imageUrl).trim() : ""
  if (!trimmedMessage && !trimmedImage) {
    res.status(400).json({ error: "กรุณาส่งข้อความหรือแนบรูป" })
    return
  }

  let user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
  })
  if (!user) {
    res.status(404).json({ error: "ไม่พบผู้ใช้" })
    return
  }

  // ---------------------------------------------------------------------
  // Auto-extract profile answers from the user's message and persist them.
  // We only run this for fields that are currently missing so we never
  // overwrite something the user explicitly set in their profile form.
  // ---------------------------------------------------------------------
  const preMissing = detectMissingProfileFields({
    age: user.age,
    weight: user.weight,
    height: user.height,
    gender: user.gender,
    allergiesText: user.allergiesText,
    noAllergies: user.noAllergies,
    diseasesText: user.diseasesText,
    noDiseases: user.noDiseases,
    currentMedications: user.currentMedications,
  })

  let extracted: ExtractedProfile = {}
  let autoSaved: (keyof ExtractedProfile)[] = []
  if (trimmedMessage && preMissing.length > 0) {
    extracted = extractProfileFromMessage(trimmedMessage, preMissing)
    if (hasAnyExtracted(extracted)) {
      const data: Prisma.UserUpdateInput = {}
      if (extracted.age !== undefined) data.age = extracted.age
      if (extracted.weight !== undefined) data.weight = extracted.weight
      if (extracted.height !== undefined) data.height = extracted.height
      if (extracted.gender !== undefined) data.gender = extracted.gender
      if (extracted.allergiesText !== undefined) {
        data.allergiesText = extracted.allergiesText
        if (extracted.noAllergies !== undefined)
          data.noAllergies = extracted.noAllergies
      }
      if (extracted.diseasesText !== undefined) {
        data.diseasesText = extracted.diseasesText
        if (extracted.noDiseases !== undefined)
          data.noDiseases = extracted.noDiseases
      }
      if (extracted.currentMedications !== undefined)
        data.currentMedications = extracted.currentMedications
      user = await prisma.user.update({ where: { id: user.id }, data })
      autoSaved = Object.keys(extracted) as (keyof ExtractedProfile)[]
    }
  }

  const snapshot = buildUserSnapshot(user)

  let session = sessionId
    ? await prisma.chatSession.findFirst({
        where: { id: sessionId, userId: user.id },
      })
    : null

  if (!session) {
    session = await prisma.chatSession.create({
      data: {
        userId: user.id,
        userProfileSnapshot: snapshot,
      },
    })
  } else if (!session.userProfileSnapshot) {
    await prisma.chatSession.update({
      where: { id: session.id },
      data: { userProfileSnapshot: snapshot },
    })
  }

  const allergyContext = user.noAllergies
    ? "ผู้ใช้ระบุว่าไม่มีประวัติแพ้ยา"
    : user.allergiesText || "ไม่ระบุประวัติแพ้ยา"
  const diseaseContext = user.noDiseases
    ? "ผู้ใช้ระบุว่าไม่มีโรคประจำตัว"
    : user.diseasesText || "ไม่ระบุโรคประจำตัว"
  const ageStr =
    user.age != null ? `${user.age} ปี` : "ไม่ระบุอายุ"
  const weightStr =
    user.weight != null ? `${user.weight} กก.` : "ไม่ระบุน้ำหนัก"
  const heightStr =
    user.height != null ? `${user.height} ซม.` : "ไม่ระบุส่วนสูง"
  const genderStr =
    user.gender && user.gender.trim() ? user.gender : "ไม่ระบุเพศ"
  const medicationsStr =
    user.currentMedications.trim() || "ไม่ระบุยาที่ทานประจำ"

  const missingFields = detectMissingProfileFields({
    age: user.age,
    weight: user.weight,
    height: user.height,
    gender: user.gender,
    allergiesText: user.allergiesText,
    noAllergies: user.noAllergies,
    diseasesText: user.diseasesText,
    noDiseases: user.noDiseases,
    currentMedications: user.currentMedications,
  })
  const missingInstruction = buildMissingFieldsInstruction(missingFields)
  const inventoryDrugsInput = await buildInventoryDrugsInput()

  const inputs: Record<string, string> = {
    allergy_context: allergyContext,
    disease_context: diseaseContext,
    allergies: allergyContext,
    diseases: diseaseContext,
    user_allergies: allergyContext,
    user_underlying_conditions: diseaseContext,
    age: ageStr,
    weight: weightStr,
    height: heightStr,
    gender: genderStr,
    current_medications: medicationsStr,
    user_current_medications: medicationsStr,
    missing_fields: missingFields.join(","),
    missing_fields_instruction: missingInstruction,
    inventory_drugs: inventoryDrugsInput,
    risk_rubric: RISK_RUBRIC_INPUT,
    off_kiosk_examples: OFF_KIOSK_EXAMPLES_INPUT,
  }

  if (trimmedMessage && isJailbreakAttempt(trimmedMessage)) {
    const refusal = jailbreakRefusalReply()
    await prisma.chatMessage.create({
      data: { sessionId: session.id, role: "assistant", content: refusal },
    })
    res.json({
      answer: refusal,
      sessionId: session.id,
      conversationId: session.difyConversationId,
      riskLevel: "LOW",
      profile: {
        missingFields,
        missingCritical: missingFields.filter((f) =>
          CRITICAL_FIELDS.includes(f)
        ),
        askedInChat: false,
        autoSavedFields: autoSaved,
      },
    })
    return
  }

  await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: "user",
      content: trimmedMessage,
      imageUrl: trimmedImage || null,
    },
  })

  // Onboarding fast-path: only trigger when the patient has literally
  // never filled in any medical info AND this is the first message of a
  // brand-new session AND we couldn't pull anything from the message body
  // (no regex match, no image). Every other case goes straight to Dify.
  const missingCritical = missingFields.filter((f) =>
    CRITICAL_FIELDS.includes(f)
  )
  const profileFullyEmpty =
    user.age == null &&
    user.weight == null &&
    user.height == null &&
    !user.noAllergies &&
    !user.allergiesText.trim()
  const isBrandNewChat = !sessionId
  const cannotExtract = !hasAnyExtracted(extracted)
  const shouldOnboardFastPath =
    isBrandNewChat &&
    profileFullyEmpty &&
    cannotExtract &&
    !trimmedImage &&
    missingCritical.length > 0

  if (shouldOnboardFastPath) {
    const askReply = buildAskMissingReply(missingCritical)
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: askReply,
      },
    })
    res.json({
      answer: askReply,
      sessionId: session.id,
      conversationId: session.difyConversationId,
      profile: {
        missingFields,
        missingCritical,
        askedInChat: true,
        autoSavedFields: autoSaved,
      },
    })
    return
  }

  try {
    const difyQuery = trimmedImage
      ? `${trimmedMessage}${trimmedMessage ? "\n\n" : ""}[แนบรูปภาพ: ${trimmedImage}]`
      : trimmedMessage
    const dify = await sendDifyChatMessage({
      query: difyQuery,
      user: user.id,
      conversationId: session.difyConversationId,
      inputs,
    })

    const patientAnswer = sanitizeAssistantOutput(
      stripPatientFacingAnswer(dify.answer)
    )
    const structured = extractStructuredJsonBlock(dify.answer)
    const riskLevel = normalizeRiskLevel(structured)

    // --- Auto SafetyCheck: scan AI answer for drugs and validate against allergies ---
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

    let qrTicket: Awaited<ReturnType<typeof issuePickupTicket>> | null = null
    const qrGate = canIssueQrFromStructured(structured, {
      missingFieldsEmpty: missingFields.length === 0,
      hasSafetyWarnings: safetyWarnings.length > 0,
      inferredSeverity: finalSeverity,
    })

    const summarySlice = (trimmedMessage || "[แนบรูปภาพ]").slice(0, 200)

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: finalAnswer,
      },
    })

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

    await prisma.chatSession.update({
      where: { id: session.id },
      data: {
        difyConversationId: dify.conversation_id || session.difyConversationId,
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

    res.json({
      answer: finalAnswer,
      sessionId: session.id,
      conversationId: dify.conversation_id,
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
        autoSavedFields: autoSaved,
      },
    })
  } catch (err) {
    console.error("Dify error:", err)
    const msg =
      err instanceof Error ? err.message : "เชื่อมต่อ AI ไม่สำเร็จ"
    res.status(502).json({
      error: msg,
      hint: "ตรวจสอบ DIFY_API_KEY และ Chat App ใน Dify",
    })
  }
}
