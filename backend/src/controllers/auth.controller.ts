import type { Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { OAuth2Client } from "google-auth-library"
import {
  isValidUsernameNormalized,
  normalizeUsername,
} from "../lib/username.js"
import { hashPassword, signToken, verifyPassword } from "../services/auth.service.js"

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
