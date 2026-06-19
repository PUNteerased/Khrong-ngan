import type { Request, Response } from "express"
import type { IssueStatus } from "@prisma/client"
import { randomUUID } from "crypto"
import { prisma } from "../lib/prisma.js"
import { resolveIssueCategory } from "../lib/issueCategories.js"

const MAX_DESCRIPTION_LEN = 4000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const IMAGE_URL_RE = /^https?:\/\/.+/i

function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value) && value.length <= 254
}

function normalizeImageUrl(raw: unknown): string | null {
  const value = String(raw || "").trim()
  if (!value) return null
  if (!IMAGE_URL_RE.test(value) || value.length > 2048) return null
  return value
}

function serializeIssueReport(row: {
  id: string
  category: string
  description: string
  reporterEmail: string
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
    reporterEmail: row.reporterEmail,
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
    subCategory?: string
    subCategoryOther?: string
    description?: string
    email?: string
    reporterEmail?: string
    imageUrl?: string
  }

  const category = resolveIssueCategory(body)
  const description = String(body.description || "").trim()
  const reporterEmail = String(body.email || body.reporterEmail || "")
    .trim()
    .toLowerCase()
  const imageUrl = normalizeImageUrl(body.imageUrl)

  if (!category) {
    res.status(400).json({ error: "หมวดหมู่ปัญหาไม่ถูกต้อง" })
    return
  }
  if (!description) {
    res.status(400).json({ error: "กรุณากรอกรายละเอียดปัญหา" })
    return
  }
  if (!reporterEmail) {
    res.status(400).json({ error: "กรุณากรอกอีเมลสำหรับติดต่อกลับ" })
    return
  }
  if (!isValidEmail(reporterEmail)) {
    res.status(400).json({ error: "รูปแบบอีเมลไม่ถูกต้อง" })
    return
  }
  if (description.length > MAX_DESCRIPTION_LEN) {
    res.status(400).json({ error: `รายละเอียดยาวเกิน ${MAX_DESCRIPTION_LEN} ตัวอักษร` })
    return
  }
  if (body.imageUrl && !imageUrl) {
    res.status(400).json({ error: "URL รูปภาพไม่ถูกต้อง" })
    return
  }

  const userId = req.auth?.userId ?? null
  const reportId = randomUUID()

  const row = await prisma.issueReport.create({
    data: {
      id: reportId,
      category,
      description,
      reporterEmail,
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
