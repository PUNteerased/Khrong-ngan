import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"

export interface AdminJwtPayload {
  type: "admin"
  role: "admin"
  userId?: string
}

declare global {
  namespace Express {
    interface Request {
      adminAuth?: AdminJwtPayload
    }
  }
}

function getAdminSecret(): string | null {
  return process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || null
}

/** ต้องมี Bearer token ที่ออกจาก POST /api/admin/login เท่านั้น */
export function adminAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const secret = getAdminSecret()
  if (!secret) {
    res.status(500).json({ error: "ไม่ได้ตั้งค่า ADMIN_JWT_SECRET หรือ JWT_SECRET" })
    return
  }
  const header = req.headers.authorization
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null
  if (!token) {
    res.status(401).json({ error: "ต้องยืนยันตัวตนผู้ดูแล" })
    return
  }
  try {
    const decoded = jwt.verify(token, secret) as AdminJwtPayload
    if (decoded.type !== "admin" || decoded.role !== "admin") {
      res.status(403).json({ error: "โทเค็นไม่ใช่ของผู้ดูแล" })
      return
    }
    req.adminAuth = { type: "admin", role: "admin" }
    next()
  } catch {
    res.status(401).json({ error: "โทเค็นผู้ดูแลไม่ถูกต้องหรือหมดอายุ" })
  }
}

/** จัดการยา: รับ JWT ผู้ดูแล หรือ header x-admin-key (ถ้าตั้ง ADMIN_API_KEY) */
export function adminOrKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const secret = getAdminSecret()
  const header = req.headers.authorization
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null

  if (token && secret) {
    try {
      const decoded = jwt.verify(token, secret) as AdminJwtPayload
      if (decoded.type === "admin" && decoded.role === "admin") {
        req.adminAuth = { type: "admin", role: "admin" }
        next()
        return
      }
    } catch {
      // fall through to key check
    }
  }

  const apiKey = process.env.ADMIN_API_KEY
  if (apiKey && req.headers["x-admin-key"] === apiKey) {
    next()
    return
  }

  res.status(403).json({
    error: "ไม่มีสิทธิ์",
    hint: "ใช้ Bearer จาก POST /api/admin/login หรือส่ง x-admin-key ถ้าตั้ง ADMIN_API_KEY",
  })
}
