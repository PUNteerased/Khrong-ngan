import type { Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { sendDifyChatMessage } from "../services/dify.service.js"

export async function postChat(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "ต้องเข้าสู่ระบบเพื่อแชท" })
    return
  }

  const { userMessage, sessionId } = req.body as {
    userMessage?: string
    sessionId?: string | null
  }

  if (!userMessage || !String(userMessage).trim()) {
    res.status(400).json({ error: "กรุณาส่งข้อความ" })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
  })
  if (!user) {
    res.status(404).json({ error: "ไม่พบผู้ใช้" })
    return
  }

  let session = sessionId
    ? await prisma.chatSession.findFirst({
        where: { id: sessionId, userId: user.id },
      })
    : null

  if (!session) {
    session = await prisma.chatSession.create({
      data: { userId: user.id },
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

  // ส่งทั้งชื่อแบบ README เดิม และชื่อที่เทมเพลต Dify นิยมใช้ (เช่น allergies / diseases)
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
      content: String(userMessage).trim(),
    },
  })

  try {
    const dify = await sendDifyChatMessage({
      query: String(userMessage).trim(),
      user: user.id,
      conversationId: session.difyConversationId,
      inputs,
    })

    await prisma.chatSession.update({
      where: { id: session.id },
      data: { difyConversationId: dify.conversation_id || session.difyConversationId },
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
