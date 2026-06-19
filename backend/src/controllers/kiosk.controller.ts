import type { Request, Response } from "express"
import {
  getKioskStatus,
  recordKioskHeartbeat,
} from "../services/kioskStatus.service.js"

export async function getPublicKioskStatus(_req: Request, res: Response) {
  const status = await getKioskStatus()
  res.json(status)
}

export async function postKioskHeartbeat(req: Request, res: Response) {
  const secret = process.env.KIOSK_HEARTBEAT_SECRET?.trim()
  const provided = String(req.headers["x-kiosk-secret"] || req.body?.secret || "").trim()

  if (!secret || provided !== secret) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const body = req.body as {
    lat?: number
    lng?: number
    name?: string
    device?: string
    firmwareVersion?: string
    firmware?: string
    rssi?: number
  }

  recordKioskHeartbeat({
    lat: body.lat,
    lng: body.lng,
    name: body.name,
    device: body.device,
    firmwareVersion: body.firmwareVersion || body.firmware,
    rssi: body.rssi,
  })

  res.json({ ok: true })
}
