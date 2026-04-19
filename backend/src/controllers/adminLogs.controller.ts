import type { Request, Response } from "express"
import { prisma } from "../lib/prisma.js"

export async function listChatSessions(req: Request, res: Response) {
  const take = Math.min(Number(req.query.limit) || 50, 100)
  const sessions = await prisma.chatSession.findMany({
    take,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { username: true, phone: true, fullName: true } },
      recommendedDrug: { select: { name: true, slotId: true } },
    },
  })

  res.json(
    sessions.map((s) => ({
      id: s.id,
      date: s.createdAt.toISOString(),
      userLabel:
        s.user.fullName || s.user.username || s.user.phone || "—",
      summary: s.summary || "—",
      drug: s.recommendedDrug
        ? `${s.recommendedDrug.name} (${s.recommendedDrug.slotId})`
        : "—",
      pickupStatus: s.pickupStatus,
      qrStatus:
        s.pickupStatus === "QR_ISSUED"
          ? "สร้างแล้ว"
          : s.pickupStatus === "PICKED"
            ? "สแกนแล้ว"
            : s.pickupStatus === "EXPIRED"
              ? "หมดอายุ"
              : "—",
      machineStatus:
        s.pickupStatus === "PICKED" ? "จ่ายสำเร็จ" : "—",
    }))
  )
}
