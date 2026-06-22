import type { Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { parseLangQuery, pickLang } from "../utils/lang.js"

export async function listUiTranslations(req: Request, res: Response) {
  const lang = parseLangQuery(req)
  const namespace = String(req.query.namespace || "").trim()
  const key = String(req.query.key || "").trim()
  const where = {
    isPublished: true,
    ...(namespace ? { namespace } : {}),
    ...(key ? { key } : {}),
  }

  const rows = await prisma.uiTranslation.findMany({
    where,
    orderBy: [{ namespace: "asc" }, { key: "asc" }],
    select: {
      namespace: true,
      key: true,
      th: true,
      en: true,
      updatedAt: true,
    },
  })
  res.json(
    rows.map((r) => ({
      namespace: r.namespace,
      key: r.key,
      th: r.th,
      en: r.en,
      value: pickLang(lang, r.th, r.en),
      updatedAt: r.updatedAt,
    }))
  )
}

