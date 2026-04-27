import type { Request, Response } from "express"
import { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma.js"

const userPublicSelect = {
  id: true,
  username: true,
  email: true,
  phone: true,
  fullName: true,
  age: true,
  weight: true,
  allergiesText: true,
  noAllergies: true,
  diseasesText: true,
  noDiseases: true,
  isAdmin: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

export async function listUsers(req: Request, res: Response) {
  const take = Math.min(Number(req.query.limit) || 30, 100)
  const skip = Math.max(0, Number(req.query.skip) || 0)
  const query = (req.query.query as string)?.trim()

  const where: Prisma.UserWhereInput = {}
  if (query) {
    where.OR = [
      { username: { contains: query, mode: "insensitive" } },
      { fullName: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { phone: { contains: query, mode: "insensitive" } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: "desc" },
      select: userPublicSelect,
    }),
    prisma.user.count({ where }),
  ])

  res.json({ items, total })
}

export async function getUser(req: Request, res: Response) {
  const id = String(req.params.id)
  const user = await prisma.user.findUnique({
    where: { id },
    select: userPublicSelect,
  })
  if (!user) {
    res.status(404).json({ error: "ไม่พบผู้ใช้" })
    return
  }

  const recentSessions = await prisma.chatSession.findMany({
    where: { userId: id },
    take: 20,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      summary: true,
      pickupStatus: true,
      severity: true,
      recommendedDrug: { select: { id: true, name: true, slotId: true } },
    },
  })

  const medicationHistory = await prisma.chatSession.findMany({
    where: {
      userId: id,
      recommendedDrugId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      pickupStatus: true,
      recommendedDrug: { select: { id: true, name: true, slotId: true } },
    },
  })

  res.json({ user, recentSessions, medicationHistory })
}

export async function patchUser(req: Request, res: Response) {
  const id = String(req.params.id)
  const body = req.body as Record<string, unknown>
  const allowed = [
    "phone",
    "fullName",
    "age",
    "weight",
    "allergiesText",
    "noAllergies",
    "diseasesText",
    "noDiseases",
  ] as const
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      if (key === "age") {
        const v = body[key]
        data.age = v === null || v === "" ? null : Number(v)
      } else if (key === "weight") {
        const v = body[key]
        data.weight = v === null || v === "" ? null : Number(v)
      } else if (key === "noAllergies" || key === "noDiseases") {
        data[key] = Boolean(body[key])
      } else if (key === "fullName") {
        data.fullName = String(body[key] ?? "").trim().slice(0, 200) || undefined
      } else if (key === "phone" || key === "allergiesText" || key === "diseasesText") {
        const v = body[key]
        data[key] = v == null || v === "" ? null : String(v).slice(0, 4000)
      }
    }
  }
  if (data.fullName === undefined) delete data.fullName
  if (typeof data.fullName === "string" && !data.fullName.trim()) {
    res.status(400).json({ error: "ชื่อเต็มต้องไม่ว่าง" })
    return
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "ไม่มีฟิลด์ที่อนุญาตให้แก้ไข" })
    return
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: data as Prisma.UserUpdateInput,
      select: userPublicSelect,
    })
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: req.adminAuth?.userId ?? undefined,
        action: "USER_PATCH",
        targetUserId: id,
        payload: data as object,
      },
    })
    res.json(user)
  } catch {
    res.status(404).json({ error: "ไม่พบผู้ใช้" })
  }
}

export async function deleteUser(req: Request, res: Response) {
  const id = String(req.params.id)
  const adminUserId = req.adminAuth?.userId ?? null
  if (adminUserId && adminUserId === id) {
    res.status(400).json({ error: "ไม่สามารถลบบัญชีผู้ดูแลที่กำลังใช้งานอยู่ได้" })
    return
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, isAdmin: true },
  })
  if (!target) {
    res.status(404).json({ error: "ไม่พบผู้ใช้" })
    return
  }
  if (target.isAdmin) {
    res.status(403).json({ error: "ไม่อนุญาตให้ลบบัญชีผู้ดูแลผ่านเมนูนี้" })
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.adminAuditLog.create({
      data: {
        adminUserId: adminUserId ?? undefined,
        action: "USER_DELETE",
        payload: {
          targetUserId: target.id,
          targetUsername: target.username,
        },
      },
    })
    await tx.user.delete({ where: { id: target.id } })
  })

  res.json({ ok: true })
}
