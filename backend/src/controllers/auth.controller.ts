import type { Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import jwt from "jsonwebtoken"
import {
  isValidUsernameNormalized,
  normalizeUsername,
} from "../lib/username.js"
import { hashPassword, signToken, verifyPassword } from "../services/auth.service.js"

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

function normalizePhone(phoneRaw: unknown): string | null {
  if (phoneRaw == null) return null
  const digits = String(phoneRaw).replace(/\D/g, "")
  return digits.length > 0 ? digits : null
}

function createOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function signPhoneVerificationToken(phone: string): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET is not set")
  return jwt.sign({ purpose: "phone_verify", phone }, secret, {
    expiresIn: "10m",
  })
}

function verifyPhoneVerificationToken(token: string, expectedPhone: string): boolean {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET is not set")
  try {
    const decoded = jwt.verify(token, secret) as {
      purpose?: string
      phone?: string
    }
    return decoded.purpose === "phone_verify" && decoded.phone === expectedPhone
  } catch {
    return false
  }
}

export async function requestPhoneOtp(req: Request, res: Response) {
  const phone = normalizePhone((req.body as { phone?: unknown })?.phone)
  if (!phone || phone.length !== 10) {
    res.status(400).json({ error: "เบอร์โทรต้องเป็นตัวเลข 10 หลัก" })
    return
  }

  const existingUser = await prisma.user.findFirst({ where: { phone } })
  if (existingUser) {
    res.status(409).json({ error: "เบอร์นี้ลงทะเบียนแล้ว" })
    return
  }

  const now = Date.now()
  const current = otpStore.get(phone)
  if (current && now - current.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
    res.status(429).json({ error: "ส่งรหัสถี่เกินไป กรุณารอสักครู่" })
    return
  }

  const code = createOtpCode()
  otpStore.set(phone, {
    code,
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: now,
  })

  const payload: { message: string; expiresInSec: number; devCode?: string } = {
    message: "ส่งรหัส OTP แล้ว",
    expiresInSec: Math.floor(OTP_TTL_MS / 1000),
  }
  if (process.env.NODE_ENV !== "production") {
    payload.devCode = code
  }
  res.json(payload)
}

export async function verifyPhoneOtp(req: Request, res: Response) {
  const { phone: phoneRaw, code } = req.body as { phone?: unknown; code?: unknown }
  const phone = normalizePhone(phoneRaw)
  const otpCode = String(code ?? "").trim()
  if (!phone || phone.length !== 10 || otpCode.length !== 6) {
    res.status(400).json({ error: "ข้อมูล OTP ไม่ถูกต้อง" })
    return
  }

  const rec = otpStore.get(phone)
  if (!rec) {
    res.status(400).json({ error: "ไม่พบ OTP สำหรับเบอร์นี้ กรุณาขอรหัสใหม่" })
    return
  }
  if (Date.now() > rec.expiresAt) {
    otpStore.delete(phone)
    res.status(400).json({ error: "OTP หมดอายุ กรุณาขอรหัสใหม่" })
    return
  }

  rec.attempts += 1
  if (rec.attempts > MAX_VERIFY_ATTEMPTS) {
    otpStore.delete(phone)
    res.status(429).json({ error: "ลองผิดหลายครั้งเกินไป กรุณาขอ OTP ใหม่" })
    return
  }

  if (rec.code !== otpCode) {
    otpStore.set(phone, rec)
    res.status(400).json({ error: "OTP ไม่ถูกต้อง" })
    return
  }

  otpStore.delete(phone)
  const verifyToken = signPhoneVerificationToken(phone)
  res.json({ message: "ยืนยันเบอร์สำเร็จ", verifyToken })
}

export async function register(req: Request, res: Response) {
  try {
    const {
      username: usernameRaw,
      phone: phoneRaw,
      password,
      fullName,
      age,
      weight,
      height,
      gender,
      allergiesText,
      noAllergies,
      allergyKeywords,
      diseasesText,
      noDiseases,
      currentMedications,
      phoneVerifyToken,
    } = req.body as Record<string, unknown>

    if (!usernameRaw || !password || !fullName) {
      res.status(400).json({
        error: "กรุณากรอก ชื่อผู้ใช้ รหัสผ่าน และชื่อ-นามสกุล",
      })
      return
    }

    const username = normalizeUsername(String(usernameRaw))
    if (!isValidUsernameNormalized(username)) {
      res.status(400).json({
        error:
          "ชื่อผู้ใช้ต้องเป็น a–z ตัวเลข . _ - ความยาว 3–32 ตัวอักษร (ไม่มีช่องว่าง)",
      })
      return
    }

    const phone =
      phoneRaw != null && String(phoneRaw).trim() !== ""
        ? String(phoneRaw).replace(/\D/g, "")
        : null
    if (!phone || phone.length !== 10) {
      res.status(400).json({ error: "กรุณากรอกเบอร์โทรศัพท์ 10 หลัก" })
      return
    }
    if (!phoneVerifyToken || typeof phoneVerifyToken !== "string") {
      res.status(400).json({ error: "กรุณายืนยัน OTP ก่อนสมัครสมาชิก" })
      return
    }
    if (!verifyPhoneVerificationToken(phoneVerifyToken, phone)) {
      res.status(400).json({ error: "OTP ไม่ถูกต้องหรือหมดอายุ กรุณายืนยันใหม่" })
      return
    }

    const exists = await prisma.user.findUnique({
      where: { username },
    })
    if (exists) {
      res.status(409).json({ error: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" })
      return
    }

    if (phone) {
      const phoneTaken = await prisma.user.findFirst({
        where: { phone },
      })
      if (phoneTaken) {
        res.status(409).json({ error: "เบอร์นี้ลงทะเบียนแล้ว" })
        return
      }
    }

    const passwordHash = await hashPassword(String(password))
    const user = await prisma.user.create({
      data: {
        username,
        phone,
        passwordHash,
        fullName: String(fullName),
        age: age != null && age !== "" ? Number(age) : null,
        weight: weight != null && weight !== "" ? Number(weight) : null,
        height: height != null && height !== "" ? Number(height) : null,
        gender:
          gender != null && String(gender).trim() !== ""
            ? String(gender)
            : null,
        allergiesText: allergiesText != null ? String(allergiesText) : "",
        allergyKeywords: allergyKeywords != null ? String(allergyKeywords) : "",
        noAllergies: Boolean(noAllergies),
        diseasesText: diseasesText != null ? String(diseasesText) : "",
        noDiseases: Boolean(noDiseases),
        currentMedications:
          currentMedications != null ? String(currentMedications) : "",
      },
    })

    const token = signToken({
      userId: user.id,
      username: user.username,
    })
    res.status(201).json({
      accessToken: token,
      user: publicUser(user),
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "ลงทะเบียนไม่สำเร็จ" })
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { username: usernameRaw, password } = req.body as {
      username?: string
      password?: string
    }
    if (!usernameRaw || !password) {
      res.status(400).json({ error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" })
      return
    }

    const username = normalizeUsername(usernameRaw)
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" })
      return
    }

    const token = signToken({
      userId: user.id,
      username: user.username,
    })
    res.json({
      accessToken: token,
      user: publicUser(user),
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "เข้าสู่ระบบไม่สำเร็จ" })
  }
}

function publicUser(user: {
  id: string
  username: string | null
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
