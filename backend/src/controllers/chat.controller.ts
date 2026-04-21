import type { Request, Response } from "express"
import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma.js"
import { sendDifyChatMessage } from "../services/dify.service.js"
import { inferSeverityFromAnswer } from "../lib/consultationSeverity.js"

function buildUserSnapshot(user: {
  fullName: string
  username: string
  phone: string | null
  age: number | null
  weight: number | null
  allergiesText: string
  noAllergies: boolean
  diseasesText: string
  noDiseases: boolean
}): Prisma.InputJsonValue {
  return {
    fullName: user.fullName,
    username: user.username,
    phone: user.phone,
    age: user.age,
    weight: user.weight,
    allergiesText: user.allergiesText,
    noAllergies: user.noAllergies,
    diseasesText: user.diseasesText,
    noDiseases: user.noDiseases,
    capturedAt: new Date().toISOString(),
  }
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

  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
  })
  if (!user) {
    res.status(404).json({ error: "ไม่พบผู้ใช้" })
    return
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

  const inputs: Record<string, string> = {
    allergy_context: allergyContext,
    disease_context: diseaseContext,
    allergies: allergyContext,
    diseases: diseaseContext,
    age: ageStr,
    weight: weightStr,
  }

  await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: "user",
      content: trimmedMessage,
      imageUrl: trimmedImage || null,
    },
  })

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

    const { severity, reason } = inferSeverityFromAnswer(dify.answer)
    const summarySlice = (trimmedMessage || "[แนบรูปภาพ]").slice(0, 200)

    await prisma.chatSession.update({
      where: { id: session.id },
      data: {
        difyConversationId: dify.conversation_id || session.difyConversationId,
        summary: session.summary ?? summarySlice,
        severity,
        redFlagReason: reason,
      },
    })

    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: dify.answer,
      },
    })

    res.json({
      answer: dify.answer,
      sessionId: session.id,
      conversationId: dify.conversation_id,
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
