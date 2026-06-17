import type { Request, Response } from "express"
import type { IssueStatus } from "@prisma/client"
import { randomUUID } from "crypto"
import { prisma } from "../lib/prisma.js"
import {
  appendIssueReportRow,
  uploadIssueImage,
} from "../services/issueReportGoogle.service.js"

<<<<<<< HEAD
const ISSUE_CATEGORIES = new Set(["medical_logic", "technical_bug", "feedback"])
const MAX_DESCRIPTION_LEN = 4000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value) && value.length <= 254
}
=======
const ISSUE_CATEGORIES = new Set(["dispenser", "qr", "ai", "other"])
const MAX_DESCRIPTION_LEN = 4000
>>>>>>> 61d7091de1b9bac3545ffb074da53557375756e1

function serializeIssueReport(row: {
  id: string
  category: string
  description: string
<<<<<<< HEAD
  reporterEmail: string
=======
>>>>>>> 61d7091de1b9bac3545ffb074da53557375756e1
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
<<<<<<< HEAD
    reporterEmail: row.reporterEmail,
=======
>>>>>>> 61d7091de1b9bac3545ffb074da53557375756e1
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

async function loadReporter(userId: string | null) {
  if (!userId) return null
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, fullName: true, email: true },
  })
}

export async function createIssueReport(req: Request, res: Response) {
  const body = req.body as {
    category?: string
    description?: string
<<<<<<< HEAD
    email?: string
    reporterEmail?: string
=======
>>>>>>> 61d7091de1b9bac3545ffb074da53557375756e1
  }

  const category = String(body.category || "").trim()
  const description = String(body.description || "").trim()
<<<<<<< HEAD
  const reporterEmail = String(body.email || body.reporterEmail || "")
    .trim()
    .toLowerCase()
=======
>>>>>>> 61d7091de1b9bac3545ffb074da53557375756e1
  const file = req.file

  if (!ISSUE_CATEGORIES.has(category)) {
    res.status(400).json({ error: "หมวดหมู่ปัญหาไม่ถูกต้อง" })
    return
  }
  if (!description) {
    res.status(400).json({ error: "กรุณากรอกรายละเอียดปัญหา" })
    return
  }
<<<<<<< HEAD
  if (!reporterEmail) {
    res.status(400).json({ error: "กรุณากรอกอีเมลสำหรับติดต่อกลับ" })
    return
  }
  if (!isValidEmail(reporterEmail)) {
    res.status(400).json({ error: "รูปแบบอีเมลไม่ถูกต้อง" })
    return
  }
=======
>>>>>>> 61d7091de1b9bac3545ffb074da53557375756e1
  if (description.length > MAX_DESCRIPTION_LEN) {
    res.status(400).json({ error: `รายละเอียดยาวเกิน ${MAX_DESCRIPTION_LEN} ตัวอักษร` })
    return
  }

  const userId = req.auth?.userId ?? null
  const reporter = await loadReporter(userId)
  const reportId = randomUUID()
  const createdAt = new Date()

  let imageUrl: string | null = null

  try {
    if (file) {
      imageUrl = await uploadIssueImage(file.buffer, file.mimetype, createdAt)
    }

    await appendIssueReportRow({
      id: reportId,
      createdAt: createdAt.toISOString(),
      category,
      description,
<<<<<<< HEAD
      reporterEmail,
=======
>>>>>>> 61d7091de1b9bac3545ffb074da53557375756e1
      imageUrl,
      reporterName: reporter?.fullName ?? "",
      reporterUsername: reporter?.username ?? "",
      userId,
      status: "OPEN",
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ส่งรายงานไป Google ไม่สำเร็จ"
    console.error("[contact] Google sync failed:", err)
    res.status(503).json({ error: msg })
    return
  }

  const row = await prisma.issueReport.create({
    data: {
      id: reportId,
      category,
      description,
<<<<<<< HEAD
      reporterEmail,
=======
>>>>>>> 61d7091de1b9bac3545ffb074da53557375756e1
      imageUrl,
      userId,
      createdAt,
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
