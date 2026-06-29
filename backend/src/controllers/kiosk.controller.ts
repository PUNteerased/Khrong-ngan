import type { Request, Response } from "express"
import { appendFileSync } from "fs"
import {
  getKioskStatus,
  recordKioskHeartbeat,
} from "../services/kioskStatus.service.js"
import {
  ackCommand,
  takePendingCommand,
} from "../services/kioskCommand.service.js"
import { syncCabinetSession } from "../services/kioskDisplay.service.js"
import { storeCameraFrame } from "../services/kioskCameraFrame.service.js"

// #region agent log
function agentLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>
) {
  try {
    appendFileSync(
      "debug-36e0e6.log",
      `${JSON.stringify({
        sessionId: "36e0e6",
        hypothesisId,
        location,
        message,
        data,
        timestamp: Date.now(),
      })}\n`
    )
  } catch {
    /* ignore when log path unavailable */
  }
}
// #endregion

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
    cameraFrameBase64?: string
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

  if (
    typeof body.cameraFrameBase64 === "string" &&
    body.cameraFrameBase64.length > 100
  ) {
    try {
      const frameBuf = Buffer.from(body.cameraFrameBase64, "base64")
      if (frameBuf.length > 100 && frameBuf.length < 512_000) {
        storeCameraFrame(frameBuf)
        // #region agent log
        agentLog("H4", "kiosk.controller:heartbeat", "stored frame from heartbeat", {
          bytes: frameBuf.length,
        })
        // #endregion
      }
    } catch {
      /* ignore invalid base64 */
    }
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
    const command: {
      id: string
      action: string
      slot: number
      code?: string
    } = {
      id: pending.id,
      action: pending.action,
      slot: pending.slot,
    }
    if (pending.code) {
      command.code = pending.code
    }
    res.json({
      ok: true,
      command,
    })
    return
  }

  res.json({ ok: true })
}
