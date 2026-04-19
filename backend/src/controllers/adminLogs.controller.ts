import type { Request, Response } from "express"
import { Prisma, type PickupStatus } from "@prisma/client"
import { prisma } from "../lib/prisma.js"

export async function listChatSessions(req: Request, res: Response) {
  const take = Math.min(Number(req.query.limit) || 50, 100)
  const skip = Math.max(0, Number(req.query.skip) || 0)
  const q = (req.query.q as string)?.trim()
  const userId = (req.query.userId as string)?.trim()
  const pickupStatus = (req.query.pickupStatus as string)?.trim()
  const redFlagOnly = req.query.redFlagOnly === "1" || req.query.redFlagOnly === "true"
  const from = req.query.from as string | undefined
  const to = req.query.to as string | undefined

  const where: Prisma.ChatSessionWhereInput = {}

  if (userId) where.userId = userId
  if (redFlagOnly) where.severity = "ESCALATE_HOSPITAL"
  if (pickupStatus && ["NONE", "QR_ISSUED", "PICKED", "EXPIRED"].includes(pickupStatus)) {
    where.pickupStatus = pickupStatus as PickupStatus
  }
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) where.createdAt.lte = new Date(to)
  }
  if (q) {
    where.OR = [
      { summary: { contains: q, mode: "insensitive" } },
      { user: { username: { contains: q, mode: "insensitive" } } },
      { user: { fullName: { contains: q, mode: "insensitive" } } },
      { user: { phone: { contains: q, mode: "insensitive" } } },
    ]
  }

  const [sessions, total] = await Promise.all([
    prisma.chatSession.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, username: true, phone: true, fullName: true } },
        recommendedDrug: { select: { name: true, slotId: true } },
      },
    }),
    prisma.chatSession.count({ where }),
  ])

  res.json({
    items: sessions.map((s) => ({
      id: s.id,
      date: s.createdAt.toISOString(),
      userId: s.userId,
      userLabel:
        s.user.fullName || s.user.username || s.user.phone || "—",
      summary: s.summary || "—",
      drug: s.recommendedDrug
        ? `${s.recommendedDrug.name} (${s.recommendedDrug.slotId})`
        : "—",
      pickupStatus: s.pickupStatus,
      severity: s.severity,
      machineStatus: s.pickupStatus === "PICKED" ? "DISPENSED" : "NONE",
    })),
    total,
  })
}

export async function getAdminSession(req: Request, res: Response) {
  const sessionId = String(req.params.sessionId)
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          phone: true,
          fullName: true,
          age: true,
          weight: true,
          allergiesText: true,
          noAllergies: true,
          diseasesText: true,
          noDiseases: true,
        },
      },
      recommendedDrug: true,
      messages: { orderBy: { createdAt: "asc" } },
      adminReview: true,
    },
  })
  if (!session) {
    res.status(404).json({ error: "ไม่พบเซสชัน" })
    return
  }

  const rec = session.recommendedDrug
  res.json({
    id: session.id,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    pickupStatus: session.pickupStatus,
    severity: session.severity,
    redFlagReason: session.redFlagReason,
    summary: session.summary,
    difyConversationId: session.difyConversationId,
    recommendedDrug: rec
      ? {
          id: rec.id,
          name: rec.name,
          description: rec.description,
          slotId: rec.slotId,
          quantity: rec.quantity,
          category: rec.category,
          dosageNotes: rec.dosageNotes,
          warnings: rec.warnings,
          expiresAt: rec.expiresAt ? rec.expiresAt.toISOString() : null,
          priceCents: rec.priceCents,
          inCabinet: rec.quantity > 0,
        }
      : null,
    userProfileSnapshot: session.userProfileSnapshot,
    userCurrent: session.user,
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    adminReview: session.adminReview,
  })
}

export async function postSessionFeedback(req: Request, res: Response) {
  const sessionId = String(req.params.sessionId)
  const { rating, note } = req.body as { rating?: string; note?: string }
  if (rating !== "UP" && rating !== "DOWN") {
    res.status(400).json({ error: "rating ต้องเป็น UP หรือ DOWN" })
    return
  }
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
  })
  if (!session) {
    res.status(404).json({ error: "ไม่พบเซสชัน" })
    return
  }
  const adminUserId = req.adminAuth?.userId ?? null
  const row = await prisma.adminSessionReview.upsert({
    where: { sessionId },
    create: {
      sessionId,
      adminUserId: adminUserId ?? undefined,
      rating,
      note: note != null ? String(note).slice(0, 2000) : null,
    },
    update: {
      adminUserId: adminUserId ?? undefined,
      rating,
      note: note != null ? String(note).slice(0, 2000) : null,
    },
  })
  res.json(row)
}
