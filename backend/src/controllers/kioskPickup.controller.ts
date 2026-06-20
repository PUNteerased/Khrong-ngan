import type { Request, Response } from "express"
import { redeemPickupTicket } from "../services/pickupTicket.service.js"

export async function postKioskRedeemTicket(req: Request, res: Response) {
  const secret = process.env.KIOSK_HEARTBEAT_SECRET?.trim()
  const provided = String(req.headers["x-kiosk-secret"] || "").trim()

  if (!secret || provided !== secret) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const body = req.body as { code?: string; signature?: string }
  const code = String(body.code ?? "").trim()
  const signature = String(body.signature ?? "").trim()

  if (!code || !signature) {
    res.status(400).json({ error: "code and signature required" })
    return
  }

  try {
    const result = await redeemPickupTicket(code, signature)
    res.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN"
    if (msg === "NOT_FOUND") {
      res.status(404).json({ error: "ไม่พบตั๋ว" })
      return
    }
    if (msg === "EXPIRED") {
      res.status(410).json({ error: "ตั๋วหมดอายุ" })
      return
    }
    if (msg === "BAD_SIGNATURE") {
      res.status(401).json({ error: "ลายเซ็นไม่ถูกต้อง" })
      return
    }
    if (msg === "OUT_OF_STOCK") {
      res.status(409).json({ error: "ยาในตู้หมด" })
      return
    }
    res.status(400).json({ error: "ไม่สามารถแลกตั๋วได้" })
  }
}
