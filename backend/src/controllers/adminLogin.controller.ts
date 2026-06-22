import type { Request, Response } from "express"
import jwt from "jsonwebtoken"
import { prisma } from "../lib/prisma.js"
import { normalizeUsername } from "../lib/username.js"
import { verifyPassword } from "../services/auth.service.js"
import type { AdminJwtPayload } from "../middleware/adminAuth.js"

function getAdminSecret(): string {
  const s = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET
  if (!s) throw new Error("no secret")
  return s
}

/**
 * เข้าสู่ระบบผู้ดูแล: ต้องเป็นบัญชี User ที่ isAdmin=true และรหัสผ่านถูกต้อง
 * ผู้ใช้ทั่วไปแม้รหัสผ่านถูกก็ได้ 403
 */
export async function adminLogin(req: Request, res: Response) {
  const { username: usernameRaw, password } = req.body as {
    username?: string
    password?: string
  }

  if (
    !usernameRaw ||
    !password ||
    typeof usernameRaw !== "string" ||
    typeof password !== "string"
  ) {
    res.status(400).json({ error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" })
    return
  }

  const username = normalizeUsername(usernameRaw)
  const user = await prisma.user.findUnique({
    where: { username },
  })

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" })
    return
  }

  if (!user.isAdmin) {
    res.status(403).json({
      error: "บัญชีนี้ไม่มีสิทธิ์เข้าสู่ระบบผู้ดูแล",
    })
    return
  }

  let secret: string
  try {
    secret = getAdminSecret()
  } catch {
    res.status(500).json({ error: "ไม่ได้ตั้งค่า JWT_SECRET หรือ ADMIN_JWT_SECRET" })
    return
  }

  const payload: AdminJwtPayload = {
    type: "admin",
    role: "admin",
    userId: user.id,
  }
  const accessToken = jwt.sign(payload, secret, { expiresIn: "8h" })
  res.json({ accessToken })
}
