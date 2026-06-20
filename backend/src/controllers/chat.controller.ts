import type { Request, Response } from "express"
import type { Prisma, User, ChatSession } from "@prisma/client"
import { prisma } from "../lib/prisma.js"
import { sendDifyChatMessage, streamDifyChatMessage } from "../services/dify.service.js"
import {
  isJailbreakAttempt,
  jailbreakRefusalReply,
  sanitizeAssistantOutput,
  RISK_RUBRIC_INPUT,
  OFF_KIOSK_EXAMPLES_INPUT,
} from "../lib/chatGuardrails.js"
import { stripPatientFacingAnswer } from "../lib/stripPatientFacingAnswer.js"
import { finalizeDifyAnswer } from "../lib/chatFinalize.js"
import { initSse, writeSse, endSse } from "../lib/sse.js"
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

export type PreparedChatContext = {
  user: User
  session: ChatSession
  inputs: Record<string, string>
  missingFields: MissingFieldKey[]
  autoSaved: (keyof ExtractedProfile)[]
  trimmedMessage: string
  trimmedImage: string
  summarySlice: string
}

const CRITICAL_FIELDS: MissingFieldKey[] = [
  "age",
  "weight",
  "height",
  "allergies",
]

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

function buildAskMissingReply(missing: MissingFieldKey[]): string {
  const header =
    "👋 สวัสดีครับ/ค่ะ ก่อนที่จะช่วยประเมินอาการและแนะนำยาให้ปลอดภัย ขอข้อมูลเพิ่มเติมอีกนิดนะครับ/ค่ะ:"
  const bullets = missing.map((k) => `• ${MISSING_FIELD_PROMPTS[k]}`)
  const footer =
    "\nเมื่อได้ข้อมูลครบแล้วระบบจะวิเคราะห์อาการและเลือกยาที่เหมาะสมให้ครับ/ค่ะ 🙏"
  return [header, "", ...bullets, footer].join("\n")
}

type EarlyChatJson = Record<string, unknown>

async function prepareChatContext(req: Request): Promise<
  | { kind: "error"; status: number; body: { error: string } }
  | { kind: "early"; body: EarlyChatJson }
  | { kind: "ready"; ctx: PreparedChatContext; extracted: ExtractedProfile; sessionIdFromClient: string | undefined }
> {
  if (!req.auth) {
    return { kind: "error", status: 401, body: { error: "ต้องเข้าสู่ระบบเพื่อแชท" } }
  }

  const { userMessage, sessionId, imageUrl } = req.body as {
    userMessage?: string
    sessionId?: string | null
    imageUrl?: string | null
  }

  const trimmedMessage = String(userMessage ?? "").trim()
  const trimmedImage = imageUrl ? String(imageUrl).trim() : ""
  if (!trimmedMessage && !trimmedImage) {
    return { kind: "error", status: 400, body: { error: "กรุณาส่งข้อความหรือแนบรูป" } }
  }

  let user = await prisma.user.findUnique({ where: { id: req.auth.userId } })
  if (!user) {
    return { kind: "error", status: 404, body: { error: "ไม่พบผู้ใช้" } }
  }

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
      data: { userId: user.id, userProfileSnapshot: snapshot },
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
    age: user.age != null ? `${user.age} ปี` : "ไม่ระบุอายุ",
    weight: user.weight != null ? `${user.weight} กก.` : "ไม่ระบุน้ำหนัก",
    height: user.height != null ? `${user.height} ซม.` : "ไม่ระบุส่วนสูง",
    gender: user.gender?.trim() ? user.gender : "ไม่ระบุเพศ",
    current_medications: user.currentMedications.trim() || "ไม่ระบุยาที่ทานประจำ",
    user_current_medications: user.currentMedications.trim() || "ไม่ระบุยาที่ทานประจำ",
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
    return {
      kind: "early",
      body: {
        answer: refusal,
        sessionId: session.id,
        conversationId: session.difyConversationId,
        riskLevel: "LOW",
        profile: {
          missingFields,
          missingCritical: missingFields.filter((f) => CRITICAL_FIELDS.includes(f)),
          askedInChat: false,
          autoSavedFields: autoSaved,
        },
      },
    }
  }

  await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: "user",
      content: trimmedMessage,
      imageUrl: trimmedImage || null,
    },
  })

  const missingCritical = missingFields.filter((f) => CRITICAL_FIELDS.includes(f))
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
      data: { sessionId: session.id, role: "assistant", content: askReply },
    })
    return {
      kind: "early",
      body: {
        answer: askReply,
        sessionId: session.id,
        conversationId: session.difyConversationId,
        profile: {
          missingFields,
          missingCritical,
          askedInChat: true,
          autoSavedFields: autoSaved,
        },
      },
    }
  }

  return {
    kind: "ready",
    ctx: {
      user,
      session,
      inputs,
      missingFields,
      autoSaved,
      trimmedMessage,
      trimmedImage,
      summarySlice: (trimmedMessage || "[แนบรูปภาพ]").slice(0, 200),
    },
    extracted,
    sessionIdFromClient: sessionId || undefined,
  }
}

function visiblePatientSlice(rawAnswer: string): string {
  return stripPatientFacingAnswer(sanitizeAssistantOutput(rawAnswer))
}

export async function postChat(req: Request, res: Response) {
  const prepared = await prepareChatContext(req)
  if (prepared.kind === "error") {
    res.status(prepared.status).json(prepared.body)
    return
  }
  if (prepared.kind === "early") {
    res.json(prepared.body)
    return
  }

  const { ctx } = prepared
  try {
    const difyQuery = ctx.trimmedImage
      ? `${ctx.trimmedMessage}${ctx.trimmedMessage ? "\n\n" : ""}[แนบรูปภาพ: ${ctx.trimmedImage}]`
      : ctx.trimmedMessage
    const dify = await sendDifyChatMessage({
      query: difyQuery,
      user: ctx.user.id,
      conversationId: ctx.session.difyConversationId,
      inputs: ctx.inputs,
    })

    const result = await finalizeDifyAnswer({
      rawDifyAnswer: dify.answer,
      difyConversationId: dify.conversation_id || null,
      session: ctx.session,
      user: ctx.user,
      missingFields: ctx.missingFields,
      autoSavedFields: ctx.autoSaved as string[],
      summarySlice: ctx.summarySlice,
    })

    res.json(result)
  } catch (err) {
    console.error("Dify error:", err)
    const msg = err instanceof Error ? err.message : "เชื่อมต่อ AI ไม่สำเร็จ"
    res.status(502).json({
      error: msg,
      hint: "ตรวจสอบ DIFY_API_KEY และ Chat App ใน Dify",
    })
  }
}

export async function postChatStream(req: Request, res: Response) {
  const prepared = await prepareChatContext(req)
  if (prepared.kind === "error") {
    res.status(prepared.status).json(prepared.body)
    return
  }

  initSse(res)

  if (prepared.kind === "early") {
    const answer = String(prepared.body.answer ?? "")
    if (answer) writeSse(res, "delta", { text: answer })
    writeSse(res, "done", prepared.body)
    endSse(res)
    return
  }

  const { ctx } = prepared
  let rawAnswer = ""
  let visibleAnswer = ""
  let difyConversationId = ctx.session.difyConversationId

  try {
    const difyQuery = ctx.trimmedImage
      ? `${ctx.trimmedMessage}${ctx.trimmedMessage ? "\n\n" : ""}[แนบรูปภาพ: ${ctx.trimmedImage}]`
      : ctx.trimmedMessage

    for await (const chunk of streamDifyChatMessage({
      query: difyQuery,
      user: ctx.user.id,
      conversationId: ctx.session.difyConversationId,
      inputs: ctx.inputs,
    })) {
      if (chunk.conversationId) difyConversationId = chunk.conversationId
      if (chunk.event !== "message" || !chunk.answer) continue

      rawAnswer += chunk.answer
      const newVisible = visiblePatientSlice(rawAnswer)
      const delta = newVisible.slice(visibleAnswer.length)
      visibleAnswer = newVisible
      if (delta) writeSse(res, "delta", { text: delta })
    }

    const result = await finalizeDifyAnswer({
      rawDifyAnswer: rawAnswer,
      difyConversationId,
      session: ctx.session,
      user: ctx.user,
      missingFields: ctx.missingFields,
      autoSavedFields: ctx.autoSaved as string[],
      summarySlice: ctx.summarySlice,
    })

    // Safety banner may prepend text not streamed — send correction if needed
    if (result.answer.length > visibleAnswer.length) {
      const tail = result.answer.slice(visibleAnswer.length)
      if (tail) writeSse(res, "delta", { text: tail })
    } else if (result.answer !== visibleAnswer) {
      writeSse(res, "replace", { text: result.answer })
    }

    writeSse(res, "done", result)
    endSse(res)
  } catch (err) {
    console.error("Dify stream error:", err)
    const msg = err instanceof Error ? err.message : "เชื่อมต่อ AI ไม่สำเร็จ"
    writeSse(res, "error", { error: msg })
    endSse(res)
  }
}
