import type { Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { parseLangQuery, pickLang } from "../utils/lang.js"

function normalizeQuery(q: string): string {
  return q.trim()
}

export async function searchHealthTips(req: Request, res: Response) {
  const lang = parseLangQuery(req)
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
  res.json(
    rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: pickLang(lang, r.titleTh, r.titleEn),
      summary: pickLang(lang, r.summaryTh, r.summaryEn),
      titleTh: r.titleTh,
      titleEn: r.titleEn,
      summaryTh: r.summaryTh,
      summaryEn: r.summaryEn,
      category: r.category,
      coverImageUrl: r.coverImageUrl,
      updatedAt: r.updatedAt,
    }))
  )
}

export async function getHealthTipDetail(req: Request, res: Response) {
  const lang = parseLangQuery(req)
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
  const title = pickLang(lang, row.titleTh, row.titleEn)
  const summary = pickLang(lang, row.summaryTh, row.summaryEn)
  const contentMd = pickLang(lang, row.contentMdTh, row.contentMdEn)
  res.json({
    id: row.id,
    slug: row.slug,
    title,
    summary,
    contentMd,
    titleTh: row.titleTh,
    titleEn: row.titleEn,
    summaryTh: row.summaryTh,
    summaryEn: row.summaryEn,
    contentMdTh: row.contentMdTh,
    contentMdEn: row.contentMdEn,
    keywords: row.keywords,
    category: row.category,
    coverImageUrl: row.coverImageUrl,
    references: row.references,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
    isPublished: row.isPublished,
  })
}
