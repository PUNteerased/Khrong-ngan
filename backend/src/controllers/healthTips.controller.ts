import type { Request, Response } from "express"
import { prisma } from "../lib/prisma.js"

function normalizeQuery(q: string): string {
  return q.trim()
}

export async function searchHealthTips(req: Request, res: Response) {
  const q = normalizeQuery(String(req.query.q || ""))
  const where = q
    ? {
        isPublished: true,
        OR: [
          { titleTh: { contains: q } },
          { titleEn: { contains: q } },
          { summaryTh: { contains: q } },
          { summaryEn: { contains: q } },
          { keywords: { contains: q } },
        ],
      }
    : { isPublished: true }

  const rows = await prisma.knowledgeHealthTip.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { titleTh: "asc" }],
    take: 50,
    select: {
      id: true,
      slug: true,
      titleTh: true,
      titleEn: true,
      summaryTh: true,
      summaryEn: true,
      category: true,
      coverImageUrl: true,
      updatedAt: true,
    },
  })
  res.json(rows)
}

export async function getHealthTipDetail(req: Request, res: Response) {
  const slug = String(req.params.slug)
  const row = await prisma.knowledgeHealthTip.findUnique({
    where: { slug },
    include: {
      references: {
        where: { isPublished: true },
        orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          url: true,
          publisher: true,
          accessedAt: true,
          note: true,
        },
      },
    },
  })
  if (!row || !row.isPublished) {
    res.status(404).json({ error: "ไม่พบเกล็ดความรู้" })
    return
  }
  res.json(row)
}

