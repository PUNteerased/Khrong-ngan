import type { Request, Response } from "express"
import {
  previewPickupTicket,
  redeemPickupTicket,
} from "../services/pickupTicket.service.js"

function kioskSecretOk(req: Request): boolean {
  const secret = process.env.KIOSK_HEARTBEAT_SECRET?.trim()
  const provided = String(req.headers["x-kiosk-secret"] || "").trim()
  return Boolean(secret && provided === secret)
}

function mapPickupError(res: Response, err: unknown) {
  const msg = err instanceof Error ? err.message : "UNKNOWN"
  if (msg === "NOT_FOUND") {
    res.status(404).json({ error: "ไม่พบตั๋ว" })
    return
  }
  if (msg === "EXPIRED") {
    res.status(410).json({ error: "ตั๋วหมดอายุ" })
    return
  }
  if (msg === "INVALID_CODE") {
    res.status(400).json({ error: "รูปแบบรหัสไม่ถูกต้อง" })
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
  if (msg === "INVALID_STATUS") {
    res.status(409).json({ error: "สถานะตั๋วไม่ถูกต้อง" })
    return
  }
  res.status(400).json({ error: "ไม่สามารถดำเนินการได้" })
}

export async function postKioskPreviewTicket(req: Request, res: Response) {
  if (!kioskSecretOk(req)) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const body = req.body as { code?: string; signature?: string }
  const code = String(body.code ?? "").trim()
  const signature = String(body.signature ?? "").trim()

  if (!code) {
    res.status(400).json({ error: "code required" })
    return
  }

  try {
    const result = await previewPickupTicket(code, signature || undefined)
    res.json(result)
  } catch (err) {
    mapPickupError(res, err)
  }
}

export async function postKioskRedeemTicket(req: Request, res: Response) {
  if (!kioskSecretOk(req)) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const body = req.body as { code?: string; signature?: string }
  const code = String(body.code ?? "").trim()
  const signature = String(body.signature ?? "").trim()

  if (!code) {
    res.status(400).json({ error: "code required" })
    return
  }

  try {
    const result = await redeemPickupTicket(code, signature || undefined)
    res.json(result)
  } catch (err) {
    mapPickupError(res, err)
  }
}
