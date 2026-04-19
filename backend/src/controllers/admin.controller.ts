import type { Request, Response } from "express"
import { prisma } from "../lib/prisma.js"

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function getStats(req: Request, res: Response) {
  const today = startOfToday()

  const [usersToday, sessionsToday, lowStock] = await Promise.all([
    prisma.user.count({
      where: { createdAt: { gte: today } },
    }),
    prisma.chatSession.count({
      where: { createdAt: { gte: today } },
    }),
    prisma.drug.count({
      where: {
        quantity: { gt: 0, lt: 2 },
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
    usersToday,
    dispensedToday: dispensed,
    alerts: lowStock,
    chatsToday: sessionsToday,
  })
}

export async function topDrugs(req: Request, res: Response) {
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
