import type { Request, Response } from "express"
import { appendFileSync } from "fs"
import {
  getCameraFrame,
  storeCameraFrame,
} from "../services/kioskCameraFrame.service.js"

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

function kioskSecretOk(req: Request): boolean {
  const secret = process.env.KIOSK_HEARTBEAT_SECRET?.trim()
  const provided = String(req.headers["x-kiosk-secret"] || "").trim()
  return Boolean(secret && provided === secret)
}

export async function postKioskCameraFrame(req: Request, res: Response) {
  // #region agent log
  agentLog("H1", "kioskCameraFrame.controller:post", "camera frame POST received", {
    contentType: String(req.headers["content-type"] || ""),
    bodyIsBuffer: Buffer.isBuffer(req.body),
    bodyLen: Buffer.isBuffer(req.body) ? req.body.length : 0,
    hasJpegBase64:
      typeof (req.body as { jpegBase64?: string })?.jpegBase64 === "string",
  })
  // #endregion

  if (!kioskSecretOk(req)) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  if (Buffer.isBuffer(req.body) && req.body.length > 100) {
    storeCameraFrame(req.body)
    // #region agent log
    agentLog("H1", "kioskCameraFrame.controller:post", "stored raw jpeg frame", {
      bytes: req.body.length,
    })
    // #endregion
    res.json({ ok: true, bytes: req.body.length })
    return
  }

  const body = req.body as { jpegBase64?: string }

  if (typeof body.jpegBase64 === "string" && body.jpegBase64.length > 0) {
    try {
      const buf = Buffer.from(body.jpegBase64, "base64")
      if (buf.length > 0 && buf.length < 512_000) {
        storeCameraFrame(buf)
        // #region agent log
        agentLog("H2", "kioskCameraFrame.controller:post", "stored base64 jpeg frame", {
          bytes: buf.length,
        })
        // #endregion
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
  // #region agent log
  agentLog("H3", "kioskCameraFrame.controller:get", "display camera frame poll", {
    hasFrame: Boolean(frame),
    bytes: frame?.length ?? 0,
  })
  // #endregion
  if (!frame) {
    res.status(204).end()
    return
  }

  res.setHeader("Content-Type", "image/jpeg")
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate")
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.send(frame)
}
