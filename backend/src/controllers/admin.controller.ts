import type { Request, Response } from "express"
import { prisma } from "../lib/prisma.js"

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

function lowStockThreshold(): number {
  const n = parseInt(process.env.LOW_STOCK_THRESHOLD || "5", 10)
  return Number.isFinite(n) && n > 0 ? n : 5
}

export async function getStats(req: Request, res: Response) {
  const today = startOfToday()
  const threshold = lowStockThreshold()

  const [
    newUsersToday,
    activeUsersToday,
    sessionsToday,
    lowStockDrugCount,
    emptyStockDrugCount,
    redFlagsToday,
  ] = await Promise.all([
    prisma.user.count({
      where: { createdAt: { gte: today } },
    }),
    prisma.chatSession
      .findMany({
        where: { createdAt: { gte: today } },
        select: { userId: true },
        distinct: ["userId"],
      })
      .then((rows) => rows.length),
    prisma.chatSession.count({
      where: { createdAt: { gte: today } },
    }),
    prisma.drug.count({
      where: {
        quantity: { gt: 0, lte: threshold },
      },
    }),
    prisma.drug.count({
      where: { quantity: 0 },
    }),
    prisma.chatSession.count({
      where: {
        createdAt: { gte: today },
        severity: "ESCALATE_HOSPITAL",
      },
    }),
  ])

  const dispensed = await prisma.chatSession.count({
    where: {
      pickupStatus: "PICKED",
      updatedAt: { gte: today },
    },
  })

  res.json({
    newUsersToday,
    activeUsersToday,
    chatsToday: sessionsToday,
    dispensedToday: dispensed,
    lowStockDrugCount,
    emptyStockDrugCount,
    redFlagsToday,
    lowStockThreshold: threshold,
  })
}

export async function getOverview(req: Request, res: Response) {
  const threshold = lowStockThreshold()
  const since = daysAgo(6)

  const [lowStockDrugs, sessionsWeek, topDrugsRows] = await Promise.all([
    prisma.drug.findMany({
      where: {
        OR: [{ quantity: { gt: 0, lte: threshold } }, { quantity: 0 }],
      },
      orderBy: [{ quantity: "asc" }, { slotId: "asc" }],
      take: 50,
      select: {
        id: true,
        name: true,
        slotId: true,
        quantity: true,
      },
    }),
    prisma.chatSession.findMany({
      where: { createdAt: { gte: since } },
      select: {
        id: true,
        createdAt: true,
        recommendedDrugId: true,
      },
    }),
    prisma.chatSession.findMany({
      where: { recommendedDrugId: { not: null } },
      select: { recommendedDrugId: true },
    }),
  ])

  const dayKey = (d: Date) => d.toISOString().slice(0, 10)
  const chatByDay = new Map<string, number>()
  for (const s of sessionsWeek) {
    const k = dayKey(new Date(s.createdAt))
    chatByDay.set(k, (chatByDay.get(k) || 0) + 1)
  }
  const dailyChats = [...chatByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  const counts = new Map<string, number>()
  for (const s of topDrugsRows) {
    if (s.recommendedDrugId) {
      counts.set(
        s.recommendedDrugId,
        (counts.get(s.recommendedDrugId) || 0) + 1
      )
    }
  }
  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  const drugs = await prisma.drug.findMany({
    where: { id: { in: sorted.map(([id]) => id) } },
  })
  const byId = new Map(drugs.map((d) => [d.id, d]))
  const topDrugsAllTime = sorted.map(([id, count]) => ({
    drug: byId.get(id) ?? null,
    count,
  }))

  res.json({
    lowStockDrugs,
    dailyChats,
    topDrugsAllTime,
  })
}

export async function topDrugs(req: Request, res: Response) {
  void req
  const sessions = await prisma.chatSession.findMany({
    where: { recommendedDrugId: { not: null } },
    select: { recommendedDrugId: true },
  })
  const counts = new Map<string, number>()
  for (const s of sessions) {
    if (s.recommendedDrugId) {
      counts.set(
        s.recommendedDrugId,
        (counts.get(s.recommendedDrugId) || 0) + 1
      )
    }
  }
  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  const drugs = await prisma.drug.findMany({
    where: { id: { in: sorted.map(([id]) => id) } },
  })
  const byId = new Map(drugs.map((d) => [d.id, d]))
  res.json(
    sorted.map(([id, count]) => ({
      drug: byId.get(id),
      count,
    }))
  )
}
