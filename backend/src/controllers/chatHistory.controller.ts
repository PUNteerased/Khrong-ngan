import type { Request, Response } from "express"
import { PickupTicketStatus } from "@prisma/client"
import { prisma } from "../lib/prisma.js"

function mapQrTicket(ticket: {
  code: string
  signature: string
  expiresAt: Date
  quantity: number
  riskLevel: string
  status: PickupTicketStatus
  drugId: string
  slotId: string
  channel: number
  drug: { name: string }
}) {
  return {
    code: ticket.code,
    signature: ticket.signature,
    expiresAt: ticket.expiresAt.toISOString(),
    quantity: ticket.quantity,
    riskLevel: ticket.riskLevel,
    status: ticket.status,
    drugId: ticket.drugId,
    slotId: ticket.slotId,
    drugName: ticket.drug.name,
    channel: ticket.channel,
  }
}

/** รายการแชทของผู้ใช้ที่ล็อกอินเท่านั้น */
export async function listMySessions(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "ต้องเข้าสู่ระบบ" })
    return
  }

  const sessions = await prisma.chatSession.findMany({
    where: { userId: req.auth.userId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, role: true },
      },
    },
  })

  res.json(
    sessions.map((s) => {
      const last = s.messages[0]
      const raw = last?.content?.slice(0, 120) || ""
      const preview = raw + (raw.length >= 120 ? "…" : "")
      return {
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        summary: s.summary,
        preview,
        messageCount: s._count.messages,
      }
    })
  )
}

/** ข้อความในชุดแชท — เฉพาะเจ้าของ session */
export async function getSessionMessages(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "ต้องเข้าสู่ระบบ" })
    return
  }

  const sessionId = String(req.params.sessionId)
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId: req.auth.userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          pickupTicket: {
            include: {
              drug: { select: { id: true, name: true, slotId: true, imageUrl: true } },
            },
          },
        },
      },
    },
  })

  if (!session) {
    res.status(404).json({ error: "ไม่พบประวัติแชท" })
    return
  }

  res.json({
    sessionId: session.id,
    createdAt: session.createdAt.toISOString(),
    messages: session.messages.map((m) => {
      const ticket = m.pickupTicket
      return {
        id: m.id,
        role: m.role,
        content: m.content,
        imageUrl: m.imageUrl,
        createdAt: m.createdAt.toISOString(),
        riskLevel: ticket?.riskLevel ?? null,
        qrTicket: ticket ? mapQrTicket(ticket) : null,
      }
    }),
  })
}
