import type { Request, Response } from "express"
import {
  getKioskStatus,
  recordKioskHeartbeat,
} from "../services/kioskStatus.service.js"
import {
  ackCommand,
  takePendingCommand,
} from "../services/kioskCommand.service.js"
import { syncCabinetSession } from "../services/kioskDisplay.service.js"

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
    commandAck?: {
      id?: string
      ok?: boolean
      error?: string
    }
    session?: {
      phase?: unknown
      countdownSec?: unknown
      camOnline?: unknown
      camPreviewUrl?: unknown
      dispenseBusy?: unknown
      error?: unknown
      preview?: unknown
    }
  }

  if (body.commandAck?.id) {
    ackCommand(
      String(body.commandAck.id),
      body.commandAck.ok !== false,
      body.commandAck.error
    )
  }

  if (body.session && typeof body.session === "object") {
    syncCabinetSession(body.session)
  }

  recordKioskHeartbeat({
    lat: body.lat,
    lng: body.lng,
    name: body.name,
    device: body.device,
    firmwareVersion: body.firmwareVersion || body.firmware,
    rssi: body.rssi,
  })

  const pending = takePendingCommand()
  if (pending) {
    res.json({
      ok: true,
      command: {
        id: pending.id,
        action: pending.action,
        slot: pending.slot,
      },
    })
    return
  }

  res.json({ ok: true })
}
