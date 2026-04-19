import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"

export interface AuthPayload {
  userId: string
  username: string
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload
    }
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null
  if (!token) {
    res.status(401).json({ error: "ต้องเข้าสู่ระบบ" })
    return
  }
  const secret = process.env.JWT_SECRET
  if (!secret) {
    res.status(500).json({ error: "JWT_SECRET ไม่ได้ตั้งค่า" })
    return
  }
  try {
    const decoded = jwt.verify(token, secret) as AuthPayload
    req.auth = decoded
    next()
  } catch {
    res.status(401).json({ error: "โทเค็นไม่ถูกต้องหรือหมดอายุ" })
  }
}
