import type { Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import jwt from "jsonwebtoken"
import { OAuth2Client } from "google-auth-library"
import {
  isValidUsernameNormalized,
  normalizeUsername,
} from "../lib/username.js"
import { hashPassword, signToken, verifyPassword } from "../services/auth.service.js"
import { sendVerificationEmail } from "../lib/mail.js"
import {
  requestPhoneOtpViaThaiBulkSms,
  verifyPhoneOtpViaThaiBulkSms,
} from "../lib/phoneOtp.js"

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
const emailOtpStore = new Map<string, OtpRecord>()
const phoneOtpTokenStore = new Map<
  string,
  { token: string; expiresAt: number; attempts: number; lastSentAt: number }
>()
const passwordResetStore = new Map<string, OtpRecord>()
const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim()
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function normalizeEmail(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).trim().toLowerCase()
  if (!s) return null
  return isValidEmail(s) ? s : null
}

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

function signEmailVerificationToken(email: string): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET is not set")
  return jwt.sign({ purpose: "email_verify", email }, secret, {
    expiresIn: "10m",
  })
}

function verifyEmailVerificationToken(token: string, expectedEmail: string): boolean {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET is not set")
  try {
    const decoded = jwt.verify(token, secret) as {
      purpose?: string
      email?: string
    }
    return decoded.purpose === "email_verify" && decoded.email === expectedEmail
  } catch {
    return false
  }
}

export async function requestEmailOtp(req: Request, res: Response) {
  const email = normalizeEmail((req.body as { email?: unknown })?.email)
  if (!email) {
    res.status(400).json({ error: "รูปแบบอีเมลไม่ถูกต้อง" })
    return
  }

  const existingUser = await prisma.user.findFirst({ where: { email } })
  if (existingUser) {
    res.status(409).json({ error: "อีเมลนี้ลงทะเบียนแล้ว" })
    return
  }

  const now = Date.now()
  const current = emailOtpStore.get(email)
  if (current && now - current.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
    res.status(429).json({ error: "ส่งรหัสถี่เกินไป กรุณารอสักครู่" })
    return
  }

  const code = createOtpCode()
  emailOtpStore.set(email, {
    code,
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: now,
  })

  const resendConfigured = Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim()
  )
  let mailResult: { sent: boolean; skippedReason?: string } = { sent: false }
  try {
    mailResult = await sendVerificationEmail(email, code)
  } catch (e) {
    console.error(e)
    emailOtpStore.delete(email)
    res.status(500).json({ error: "ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า SMTP" })
    return
  }

  if (!mailResult.sent && process.env.NODE_ENV === "production") {
    emailOtpStore.delete(email)
    res.status(503).json({
      error: "ระบบส่งอีเมลยังไม่พร้อม กรุณาตั้งค่า SMTP บนเซิร์ฟเวอร์",
      hint: mailResult.skippedReason,
    })
    return
  }

  const payload: { message: string; expiresInSec: number; devCode?: string } = {
    message: resendConfigured
      ? "ส่งรหัสไปที่อีเมลแล้ว"
      : "สร้างรหัสแล้ว (โหมดทดสอบ — ยังไม่ได้ส่งอีเมล)",
    expiresInSec: Math.floor(OTP_TTL_MS / 1000),
  }
  if (process.env.NODE_ENV !== "production") {
    payload.devCode = code
  }
  if (!resendConfigured) {
    console.info(`[email-otp] ${email} code=${code}`)
  }
  res.json(payload)
}

export async function verifyEmailOtp(req: Request, res: Response) {
  const { email: emailRaw, code } = req.body as { email?: unknown; code?: unknown }
  const email = normalizeEmail(emailRaw)
  const otpCode = String(code ?? "").trim()
  if (!email || otpCode.length !== 6) {
    res.status(400).json({ error: "ข้อมูล OTP ไม่ถูกต้อง" })
    return
  }

  const rec = emailOtpStore.get(email)
  if (!rec) {
    res.status(400).json({ error: "ไม่พบ OTP สำหรับอีเมลนี้ กรุณาขอรหัสใหม่" })
    return
  }
  if (Date.now() > rec.expiresAt) {
    emailOtpStore.delete(email)
    res.status(400).json({ error: "OTP หมดอายุ กรุณาขอรหัสใหม่" })
    return
  }

  rec.attempts += 1
  if (rec.attempts > MAX_VERIFY_ATTEMPTS) {
    emailOtpStore.delete(email)
    res.status(429).json({ error: "ลองผิดหลายครั้งเกินไป กรุณาขอ OTP ใหม่" })
    return
  }

  if (rec.code !== otpCode) {
    emailOtpStore.set(email, rec)
    res.status(400).json({ error: "OTP ไม่ถูกต้อง" })
    return
  }

  emailOtpStore.delete(email)
  const verifyToken = signEmailVerificationToken(email)
  res.json({ message: "ยืนยันอีเมลสำเร็จ", verifyToken })
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
  const current = phoneOtpTokenStore.get(phone)
  if (current && now - current.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
    res.status(429).json({ error: "ส่งรหัสถี่เกินไป กรุณารอสักครู่" })
    return
  }

  const result = await requestPhoneOtpViaThaiBulkSms(phone)
  if (!result.sent) {
    if (process.env.NODE_ENV === "production") {
      res.status(503).json({
        error: "ระบบส่ง OTP เบอร์โทรยังไม่พร้อม กรุณาตั้งค่า ThaiBulkSMS",
        hint: result.skippedReason,
      })
      return
    }

    const code = createOtpCode()
    otpStore.set(phone, {
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

  phoneOtpTokenStore.set(phone, {
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

export async function verifyPhoneOtp(req: Request, res: Response) {
  const { phone: phoneRaw, code } = req.body as { phone?: unknown; code?: unknown }
  const phone = normalizePhone(phoneRaw)
  const otpCode = String(code ?? "").trim()
  if (!phone || phone.length !== 10 || otpCode.length !== 6) {
    res.status(400).json({ error: "ข้อมูล OTP ไม่ถูกต้อง" })
    return
  }

  const providerRec = phoneOtpTokenStore.get(phone)
  if (providerRec) {
    if (Date.now() > providerRec.expiresAt) {
      phoneOtpTokenStore.delete(phone)
      res.status(400).json({ error: "OTP หมดอายุ กรุณาขอรหัสใหม่" })
      return
    }
    providerRec.attempts += 1
    if (providerRec.attempts > MAX_VERIFY_ATTEMPTS) {
      phoneOtpTokenStore.delete(phone)
      res.status(429).json({ error: "ลองผิดหลายครั้งเกินไป กรุณาขอ OTP ใหม่" })
      return
    }

    const verify = await verifyPhoneOtpViaThaiBulkSms(providerRec.token, otpCode)
    if (!verify.verified) {
      phoneOtpTokenStore.set(phone, providerRec)
      res.status(400).json({ error: verify.message || "OTP ไม่ถูกต้อง" })
      return
    }

    phoneOtpTokenStore.delete(phone)
    const verifyToken = signPhoneVerificationToken(phone)
    res.json({ message: "ยืนยันเบอร์สำเร็จ", verifyToken })
    return
  }

  // fallback for local dev mode when provider is not configured
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
      email: emailRaw,
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
    if (username.toLowerCase().includes("admin")) {
      res.status(400).json({
        error: "ชื่อผู้ใช้ห้ามมีคำว่า admin",
      })
      return
    }

    const email = normalizeEmail(emailRaw)
    if (!email) {
      res.status(400).json({ error: "กรุณากรอกอีเมลที่ถูกต้อง" })
      return
    }
    const phone =
      phoneRaw != null && String(phoneRaw).trim() !== ""
        ? String(phoneRaw).replace(/\D/g, "")
        : null
    if (phone && phone.length !== 10) {
      res.status(400).json({ error: "ถ้ากรอกเบอร์โทร ต้องเป็นตัวเลข 10 หลัก" })
      return
    }
    if (phone) {
      if (!phoneVerifyToken || typeof phoneVerifyToken !== "string") {
        res.status(400).json({ error: "กรุณายืนยัน OTP เบอร์โทรก่อนสมัครสมาชิก" })
        return
      }
      if (!verifyPhoneVerificationToken(phoneVerifyToken, phone)) {
        res.status(400).json({ error: "OTP เบอร์โทรไม่ถูกต้องหรือหมดอายุ กรุณายืนยันใหม่" })
        return
      }
    }

    const exists = await prisma.user.findUnique({
      where: { username },
    })
    if (exists) {
      res.status(409).json({ error: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" })
      return
    }

    const emailTaken = await prisma.user.findFirst({ where: { email } })
    if (emailTaken) {
      res.status(409).json({ error: "อีเมลนี้ลงทะเบียนแล้ว" })
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
        email,
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

export async function loginWithGoogle(req: Request, res: Response) {
  try {
    if (!googleClient || !googleClientId) {
      res.status(503).json({ error: "ยังไม่ได้ตั้งค่า Google Login บนเซิร์ฟเวอร์" })
      return
    }

    const { idToken } = req.body as { idToken?: string }
    if (!idToken || typeof idToken !== "string") {
      res.status(400).json({ error: "ไม่พบ Google ID token" })
      return
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleClientId,
    })
    const payload = ticket.getPayload()
    if (!payload?.sub) {
      res.status(401).json({ error: "ยืนยันตัวตน Google ไม่สำเร็จ" })
      return
    }
    const ev = payload.email_verified as boolean | string | undefined
    const emailVerified = ev === true || ev === "true"
    if (!payload.email || !emailVerified) {
      res.status(401).json({ error: "บัญชี Google นี้ยังไม่ยืนยันอีเมล" })
      return
    }

    const googleEmail = normalizeEmail(payload.email)
    if (!googleEmail) {
      res.status(401).json({ error: "ไม่พบอีเมลจากบัญชี Google" })
      return
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ email: googleEmail }, { username: normalizeUsername(`g_${payload.sub}`) }],
      },
    })
    if (!user) {
      const username = normalizeUsername(`g_${payload.sub}`)
      if (!isValidUsernameNormalized(username)) {
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการสร้างชื่อผู้ใช้" })
        return
      }
      const passwordHash = await hashPassword(`google:${payload.sub}:${Date.now()}`)
      const fallbackName = payload.email.split("@")[0] || "Google User"
      user = await prisma.user.create({
        data: {
          username,
          email: googleEmail,
          phone: null,
          passwordHash,
          fullName: payload.name?.trim() || fallbackName,
          avatarUrl: payload.picture ?? null,
        },
      })
    } else {
      const updates: { avatarUrl?: string | null; email?: string } = {}
      if (!user.email) updates.email = googleEmail
      if (payload.picture && user.avatarUrl !== payload.picture) {
        updates.avatarUrl = payload.picture
      }
      if (Object.keys(updates).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updates,
        })
      }
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
    res.status(500).json({ error: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ" })
  }
}

export async function requestPasswordReset(req: Request, res: Response) {
  const { username: usernameRaw, email: emailRaw } = req.body as {
    username?: unknown
    email?: unknown
  }
  const username = usernameRaw ? normalizeUsername(String(usernameRaw)) : ""
  const email = normalizeEmail(emailRaw)
  if (!username || !email) {
    res.status(400).json({ error: "กรุณากรอกชื่อผู้ใช้และอีเมลให้ถูกต้อง" })
    return
  }
  const user = await prisma.user.findFirst({
    where: { username, email },
    select: { id: true, email: true },
  })
  if (!user?.email) {
    res.status(404).json({ error: "ไม่พบบัญชีที่ตรงกับข้อมูล" })
    return
  }

  const key = `${username}:${user.email}`
  const now = Date.now()
  const current = passwordResetStore.get(key)
  if (current && now - current.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
    res.status(429).json({ error: "ส่งรหัสถี่เกินไป กรุณารอสักครู่" })
    return
  }
  const code = createOtpCode()
  passwordResetStore.set(key, {
    code,
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: now,
  })

  const resendConfigured = Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim()
  )
  let mailResult: { sent: boolean; skippedReason?: string } = { sent: false }
  try {
    mailResult = await sendVerificationEmail(user.email, code)
  } catch (e) {
    console.error(e)
    passwordResetStore.delete(key)
    res.status(500).json({ error: "ส่งอีเมลไม่สำเร็จ" })
    return
  }
  if (!mailResult.sent && process.env.NODE_ENV === "production") {
    passwordResetStore.delete(key)
    res.status(503).json({
      error: "ระบบส่งอีเมลยังไม่พร้อม",
      hint: mailResult.skippedReason,
    })
    return
  }

  const payload: { message: string; expiresInSec: number; devCode?: string } = {
    message: resendConfigured
      ? "ส่งรหัสรีเซ็ตรหัสผ่านไปที่อีเมลแล้ว"
      : "สร้างรหัสแล้ว (โหมดทดสอบ — ยังไม่ได้ส่งอีเมล)",
    expiresInSec: Math.floor(OTP_TTL_MS / 1000),
  }
  if (process.env.NODE_ENV !== "production") payload.devCode = code
  res.json(payload)
}

export async function confirmPasswordReset(req: Request, res: Response) {
  const {
    username: usernameRaw,
    email: emailRaw,
    code,
    newPassword,
  } = req.body as {
    username?: unknown
    email?: unknown
    code?: unknown
    newPassword?: unknown
  }
  const username = usernameRaw ? normalizeUsername(String(usernameRaw)) : ""
  const email = normalizeEmail(emailRaw)
  const otpCode = String(code ?? "").trim()
  const nextPassword = String(newPassword ?? "")
  if (!username || !email || otpCode.length !== 6 || nextPassword.length < 6) {
    res.status(400).json({ error: "ข้อมูลไม่ถูกต้อง" })
    return
  }
  const key = `${username}:${email}`
  const rec = passwordResetStore.get(key)
  if (!rec) {
    res.status(400).json({ error: "ไม่พบ OTP กรุณาขอรหัสใหม่" })
    return
  }
  if (Date.now() > rec.expiresAt) {
    passwordResetStore.delete(key)
    res.status(400).json({ error: "OTP หมดอายุ กรุณาขอรหัสใหม่" })
    return
  }
  rec.attempts += 1
  if (rec.attempts > MAX_VERIFY_ATTEMPTS) {
    passwordResetStore.delete(key)
    res.status(429).json({ error: "ลองผิดหลายครั้งเกินไป กรุณาขอ OTP ใหม่" })
    return
  }
  if (rec.code !== otpCode) {
    passwordResetStore.set(key, rec)
    res.status(400).json({ error: "OTP ไม่ถูกต้อง" })
    return
  }
  const user = await prisma.user.findFirst({
    where: { username, email },
    select: { id: true },
  })
  if (!user) {
    passwordResetStore.delete(key)
    res.status(404).json({ error: "ไม่พบบัญชีผู้ใช้" })
    return
  }
  const passwordHash = await hashPassword(nextPassword)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })
  passwordResetStore.delete(key)
  res.json({ message: "ตั้งรหัสผ่านใหม่สำเร็จ" })
}

function publicUser(user: {
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
