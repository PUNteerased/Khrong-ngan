import type { Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import {
  isValidUsernameNormalized,
  normalizeUsername,
} from "../lib/username.js"
import { hashPassword, signToken, verifyPassword } from "../services/auth.service.js"

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
    if (phone !== null && phone.length !== 10) {
      res.status(400).json({ error: "เบอร์โทรต้องเป็นตัวเลข 10 หลัก หรือเว้นว่าง" })
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
