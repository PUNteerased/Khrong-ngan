import type { Request, Response } from "express"
import {
  getCameraFrame,
  storeCameraFrame,
} from "../services/kioskCameraFrame.service.js"

function kioskSecretOk(req: Request): boolean {
  const secret = process.env.KIOSK_HEARTBEAT_SECRET?.trim()
  const provided = String(req.headers["x-kiosk-secret"] || "").trim()
  return Boolean(secret && provided === secret)
}

export async function postKioskCameraFrame(req: Request, res: Response) {
  if (!kioskSecretOk(req)) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  if (Buffer.isBuffer(req.body) && req.body.length > 100) {
    storeCameraFrame(req.body)
    res.json({ ok: true, bytes: req.body.length })
    return
  }

  const body = req.body as { jpegBase64?: string }

  if (typeof body.jpegBase64 === "string" && body.jpegBase64.length > 0) {
    try {
      const buf = Buffer.from(body.jpegBase64, "base64")
      if (buf.length > 0 && buf.length < 512_000) {
        storeCameraFrame(buf)
        res.json({ ok: true, bytes: buf.length })
        return
      }
    } catch {
      res.status(400).json({ error: "invalid base64" })
      return
    }
  }

  res.status(400).json({ error: "missing jpeg body" })
}

export async function getKioskDisplayCameraFrame(_req: Request, res: Response) {
  const frame = getCameraFrame()
  if (!frame) {
    res.status(204).end()
    return
  }

  res.setHeader("Content-Type", "image/jpeg")
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate")
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.send(frame)
}
