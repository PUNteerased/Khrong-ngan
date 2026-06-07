import type { Request, Response } from "express"
import type { IssueStatus } from "@prisma/client"
import { prisma } from "../lib/prisma.js"

const ISSUE_CATEGORIES = new Set(["dispenser", "qr", "ai", "other"])
const MAX_DESCRIPTION_LEN = 4000
const MAX_IMAGE_URL_LEN = 2048

function serializeIssueReport(row: {
  id: string
  category: string
  description: string
  imageUrl: string | null
  status: IssueStatus
  userId: string | null
  createdAt: Date
  updatedAt: Date
  user?: {
    id: string
    username: string
    fullName: string
    email: string | null
  } | null
}) {
  return {
    id: row.id,
    category: row.category,
    description: row.description,
    imageUrl: row.imageUrl,
    status: row.status,
    userId: row.userId,
    reporter: row.user
      ? {
          id: row.user.id,
          username: row.user.username,
          fullName: row.user.fullName,
          email: row.user.email,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function createIssueReport(req: Request, res: Response) {
  const body = req.body as {
    category?: string
    description?: string
    imageUrl?: string | null
  }

  const category = String(body.category || "").trim()
  const description = String(body.description || "").trim()
  const imageUrlRaw = body.imageUrl == null ? null : String(body.imageUrl).trim()

  if (!ISSUE_CATEGORIES.has(category)) {
    res.status(400).json({ error: "หมวดหมู่ปัญหาไม่ถูกต้อง" })
    return
  }
  if (!description) {
    res.status(400).json({ error: "กรุณากรอกรายละเอียดปัญหา" })
    return
  }
  if (description.length > MAX_DESCRIPTION_LEN) {
    res.status(400).json({ error: `รายละเอียดยาวเกิน ${MAX_DESCRIPTION_LEN} ตัวอักษร` })
    return
  }

  let imageUrl: string | null = null
  if (imageUrlRaw) {
    if (imageUrlRaw.length > MAX_IMAGE_URL_LEN) {
      res.status(400).json({ error: "URL รูปภาพไม่ถูกต้อง" })
      return
    }
    try {
      const parsed = new URL(imageUrlRaw)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        res.status(400).json({ error: "URL รูปภาพไม่ถูกต้อง" })
        return
      }
      imageUrl = imageUrlRaw
    } catch {
      res.status(400).json({ error: "URL รูปภาพไม่ถูกต้อง" })
      return
    }
  }

  const userId = req.auth?.userId ?? null

  const row = await prisma.issueReport.create({
    data: {
      category,
      description,
      imageUrl,
      userId,
    },
    include: {
      user: {
        select: { id: true, username: true, fullName: true, email: true },
      },
    },
  })

  res.status(201).json(serializeIssueReport(row))
}

export async function listIssueReports(req: Request, res: Response) {
  const statusRaw = (req.query.status as string) || ""
  const where: { status?: IssueStatus } = {}
  if (statusRaw === "OPEN" || statusRaw === "RESOLVED") {
    where.status = statusRaw
  }

  const rows = await prisma.issueReport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: {
        select: { id: true, username: true, fullName: true, email: true },
      },
    },
  })

  res.json(rows.map(serializeIssueReport))
}

export async function updateIssueReportStatus(req: Request, res: Response) {
  const id = String(req.params.id)
  const body = req.body as { status?: string }
  const status = String(body.status || "").trim()

  if (status !== "OPEN" && status !== "RESOLVED") {
    res.status(400).json({ error: "สถานะไม่ถูกต้อง" })
    return
  }

  const existing = await prisma.issueReport.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: "ไม่พบรายการแจ้งปัญหา" })
    return
  }

  const row = await prisma.issueReport.update({
    where: { id },
    data: { status: status as IssueStatus },
    include: {
      user: {
        select: { id: true, username: true, fullName: true, email: true },
      },
    },
  })

  res.json(serializeIssueReport(row))
}
