import type { Request, Response } from "express"
import { prisma } from "../lib/prisma.js"

export async function listUiTranslations(req: Request, res: Response) {
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
  res.json(rows)
}

