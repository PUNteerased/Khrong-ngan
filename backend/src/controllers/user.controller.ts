import type { Request, Response } from "express"
import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma.js"
import { verifyPassword, hashPassword } from "../services/auth.service.js"

export async function getMe(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }
  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
  })
  if (!user) {
    res.status(404).json({ error: "ไม่พบผู้ใช้" })
    return
  }
  res.json(serializeUser(user))
}

export async function patchMe(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }
  const {
    fullName,
    avatarUrl,
    age,
    weight,
    height,
    gender,
    allergiesText,
    allergyKeywords,
    noAllergies,
    diseasesText,
    noDiseases,
    currentMedications,
    email,
    phone,
  } = req.body as Record<string, unknown>

  const data: Prisma.UserUpdateInput = {}
  if (fullName !== undefined) data.fullName = String(fullName)
  if (avatarUrl !== undefined)
    data.avatarUrl = avatarUrl ? String(avatarUrl) : null
  if (age !== undefined) data.age = age === null || age === "" ? null : Number(age)
  if (weight !== undefined)
    data.weight = weight === null || weight === "" ? null : Number(weight)
  if (height !== undefined)
    data.height = height === null || height === "" ? null : Number(height)
  if (gender !== undefined)
    data.gender =
      gender === null || String(gender).trim() === "" ? null : String(gender)
  if (allergiesText !== undefined) data.allergiesText = String(allergiesText)
  if (allergyKeywords !== undefined)
    data.allergyKeywords = String(allergyKeywords)
  if (noAllergies !== undefined) data.noAllergies = Boolean(noAllergies)
  if (diseasesText !== undefined) data.diseasesText = String(diseasesText)
  if (noDiseases !== undefined) data.noDiseases = Boolean(noDiseases)
  if (currentMedications !== undefined)
    data.currentMedications = String(currentMedications)
  if (email !== undefined) {
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail) {
      res.status(400).json({ error: "รูปแบบอีเมลไม่ถูกต้อง" })
      return
    }
    const emailTaken = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        id: { not: req.auth.userId },
      },
      select: { id: true },
    })
    if (emailTaken) {
      res.status(409).json({ error: "อีเมลนี้ถูกใช้งานแล้ว" })
      return
    }
    data.email = normalizedEmail
  }
  if (phone !== undefined) {
    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone || normalizedPhone.length !== 10) {
      res.status(400).json({ error: "เบอร์โทรต้องเป็นตัวเลข 10 หลัก" })
      return
    }
    const phoneTaken = await prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        id: { not: req.auth.userId },
      },
      select: { id: true },
    })
    if (phoneTaken) {
      res.status(409).json({ error: "เบอร์นี้ถูกใช้งานแล้ว" })
      return
    }
    data.phone = normalizedPhone
  }

  const user = await prisma.user.update({
    where: { id: req.auth.userId },
    data,
  })

  res.json(serializeUser(user))
}

export async function changeMyPassword(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string
    newPassword?: string
  }
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่" })
    return
  }
  if (String(newPassword).length < 6) {
    res.status(400).json({ error: "รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร" })
    return
  }
  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { id: true, passwordHash: true },
  })
  if (!user) {
    res.status(404).json({ error: "ไม่พบผู้ใช้" })
    return
  }
  const ok = await verifyPassword(currentPassword, user.passwordHash)
  if (!ok) {
    res.status(400).json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" })
    return
  }
  const passwordHash = await hashPassword(newPassword)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })
  res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ" })
}

export async function deleteMe(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  await prisma.user.delete({
    where: { id: req.auth.userId },
  })

  res.status(204).send()
}

function serializeUser(user: {
  id: string
  username: string | null
  email: string | null
  phone: string | null
  isAdmin: boolean
  fullName: string
  avatarUrl: string | null
  age: number | null
  weight: number | null
  height: number | null
  gender: string | null
  allergiesText: string
  allergyKeywords: string
  noAllergies: boolean
  diseasesText: string
  noDiseases: boolean
  currentMedications: string
}) {
  return {
    id: user.id,
    username: user.username ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    isAdmin: user.isAdmin,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    age: user.age,
    weight: user.weight,
    height: user.height,
    gender: user.gender,
    allergiesText: user.allergiesText,
    allergyKeywords: user.allergyKeywords,
    noAllergies: user.noAllergies,
    diseasesText: user.diseasesText,
    noDiseases: user.noDiseases,
    currentMedications: user.currentMedications,
  }
}

function normalizePhone(phoneRaw: unknown): string | null {
  if (phoneRaw == null) return null
  const digits = String(phoneRaw).replace(/\D/g, "")
  return digits.length > 0 ? digits : null
}

function normalizeEmail(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).trim().toLowerCase()
  if (!s) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null
}
