import type { Request, Response } from "express"
import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma.js"
import jwt from "jsonwebtoken"
import { verifyPassword, hashPassword } from "../services/auth.service.js"
import {
  requestPhoneOtpViaThaiBulkSms,
  verifyPhoneOtpViaThaiBulkSms,
} from "../lib/phoneOtp.js"

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
    phoneVerifyToken,
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
    if (!phoneVerifyToken || typeof phoneVerifyToken !== "string") {
      res.status(400).json({ error: "กรุณายืนยัน OTP เบอร์โทรก่อนบันทึก" })
      return
    }
    if (!verifyPhoneChangeToken(phoneVerifyToken, req.auth.userId, normalizedPhone)) {
      res.status(400).json({ error: "โทเค็นยืนยันเบอร์ไม่ถูกต้องหรือหมดอายุ" })
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

export async function requestPhoneChangeOtp(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }
  const phone = normalizePhone((req.body as { phone?: unknown })?.phone)
  if (!phone || phone.length !== 10) {
    res.status(400).json({ error: "เบอร์โทรต้องเป็นตัวเลข 10 หลัก" })
    return
  }
  const me = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { phone: true },
  })
  if (!me) {
    res.status(404).json({ error: "ไม่พบผู้ใช้" })
    return
  }
  if (me.phone === phone) {
    res.status(400).json({ error: "เบอร์ใหม่นี้ตรงกับเบอร์ปัจจุบัน" })
    return
  }
  const existing = await prisma.user.findFirst({
    where: { phone, id: { not: req.auth.userId } },
    select: { id: true },
  })
  if (existing) {
    res.status(409).json({ error: "เบอร์นี้ถูกใช้งานแล้ว" })
    return
  }

  const now = Date.now()
  const key = phoneOtpKey(req.auth.userId, phone)
  const current = phoneOtpTokenStore.get(key)
  if (current && now - current.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
    res.status(429).json({ error: "ส่งรหัสถี่เกินไป กรุณารอสักครู่" })
    return
  }

  const result = await requestPhoneOtpViaThaiBulkSms(phone)
  if (!result.sent) {
    if (process.env.NODE_ENV === "production") {
      res.status(503).json({
        error: "ระบบส่ง OTP เบอร์โทรยังไม่พร้อม",
        hint: result.skippedReason,
      })
      return
    }
    const code = createOtpCode()
    otpStore.set(key, {
      code,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      lastSentAt: now,
    })
    res.json({
      message: "สร้างรหัสแล้ว (โหมดทดสอบ — ยังไม่ได้ส่ง SMS)",
      expiresInSec: Math.floor(OTP_TTL_MS / 1000),
      devCode: code,
    })
    return
  }

  phoneOtpTokenStore.set(key, {
    token: result.token,
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: now,
  })
  res.json({
    message: "ส่งรหัส OTP แล้ว",
    expiresInSec: Math.floor(OTP_TTL_MS / 1000),
  })
}

export async function verifyPhoneChangeOtp(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }
  const { phone: phoneRaw, code } = req.body as { phone?: unknown; code?: unknown }
  const phone = normalizePhone(phoneRaw)
  const otpCode = String(code ?? "").trim()
  if (!phone || phone.length !== 10 || otpCode.length !== 6) {
    res.status(400).json({ error: "ข้อมูล OTP ไม่ถูกต้อง" })
    return
  }
  const key = phoneOtpKey(req.auth.userId, phone)
  const providerRec = phoneOtpTokenStore.get(key)
  if (providerRec) {
    if (Date.now() > providerRec.expiresAt) {
      phoneOtpTokenStore.delete(key)
      res.status(400).json({ error: "OTP หมดอายุ กรุณาขอรหัสใหม่" })
      return
    }
    providerRec.attempts += 1
    if (providerRec.attempts > MAX_VERIFY_ATTEMPTS) {
      phoneOtpTokenStore.delete(key)
      res.status(429).json({ error: "ลองผิดหลายครั้งเกินไป กรุณาขอ OTP ใหม่" })
      return
    }
    const verify = await verifyPhoneOtpViaThaiBulkSms(providerRec.token, otpCode)
    if (!verify.verified) {
      phoneOtpTokenStore.set(key, providerRec)
      res.status(400).json({ error: verify.message || "OTP ไม่ถูกต้อง" })
      return
    }
    phoneOtpTokenStore.delete(key)
    const verifyToken = signPhoneChangeToken(req.auth.userId, phone)
    res.json({ message: "ยืนยันเบอร์สำเร็จ", verifyToken })
    return
  }

  const rec = otpStore.get(key)
  if (!rec) {
    res.status(400).json({ error: "ไม่พบ OTP สำหรับเบอร์นี้ กรุณาขอรหัสใหม่" })
    return
  }
  if (Date.now() > rec.expiresAt) {
    otpStore.delete(key)
    res.status(400).json({ error: "OTP หมดอายุ กรุณาขอรหัสใหม่" })
    return
  }
  rec.attempts += 1
  if (rec.attempts > MAX_VERIFY_ATTEMPTS) {
    otpStore.delete(key)
    res.status(429).json({ error: "ลองผิดหลายครั้งเกินไป กรุณาขอ OTP ใหม่" })
    return
  }
  if (rec.code !== otpCode) {
    otpStore.set(key, rec)
    res.status(400).json({ error: "OTP ไม่ถูกต้อง" })
    return
  }
  otpStore.delete(key)
  const verifyToken = signPhoneChangeToken(req.auth.userId, phone)
  res.json({ message: "ยืนยันเบอร์สำเร็จ", verifyToken })
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

type OtpRecord = {
  code: string
  expiresAt: number
  attempts: number
  lastSentAt: number
}

const OTP_TTL_MS = 5 * 60 * 1000
const OTP_RESEND_COOLDOWN_MS = 45 * 1000
const MAX_VERIFY_ATTEMPTS = 5
const otpStore = new Map<string, OtpRecord>()
const phoneOtpTokenStore = new Map<
  string,
  { token: string; expiresAt: number; attempts: number; lastSentAt: number }
>()

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

function createOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function phoneOtpKey(userId: string, phone: string): string {
  return `${userId}:${phone}`
}

function signPhoneChangeToken(userId: string, phone: string): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET is not set")
  return jwt.sign({ purpose: "phone_change", userId, phone }, secret, {
    expiresIn: "10m",
  })
}

function verifyPhoneChangeToken(token: string, expectedUserId: string, expectedPhone: string): boolean {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET is not set")
  try {
    const decoded = jwt.verify(token, secret) as {
      purpose?: string
      userId?: string
      phone?: string
    }
    return (
      decoded.purpose === "phone_change" &&
      decoded.userId === expectedUserId &&
      decoded.phone === expectedPhone
    )
  } catch {
    return false
  }
}
