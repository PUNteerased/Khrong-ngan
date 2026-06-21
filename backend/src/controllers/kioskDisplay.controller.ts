import type { Request, Response } from "express"
import { isCabinetOnline } from "../services/kioskStatus.service.js"
import {
  getCabinetSessionSnapshot,
  isCabinetPreviewExpired,
  setCabinetPreviewFromTablet,
  syncCabinetSession,
} from "../services/kioskDisplay.service.js"
import {
  queueDisplayConfirmPickup,
  queueDisplayScanCancel,
  queueDisplayScanStart,
  queueDisplaySubmitCode,
} from "../services/kioskCommand.service.js"
import { previewPickupTicket } from "../services/pickupTicket.service.js"

function mapCommandError(res: Response, err: unknown) {
  const msg = err instanceof Error ? err.message : "UNKNOWN"
  if (msg === "COMMAND_IN_PROGRESS") {
    res.status(409).json({ error: "command in progress" })
    return
  }
  if (msg === "INVALID_CODE") {
    res.status(400).json({ error: "รูปแบบรหัสไม่ถูกต้อง" })
    return
  }
  res.status(500).json({ error: "command failed" })
}

function mapPickupPreviewError(res: Response, err: unknown) {
  const msg = err instanceof Error ? err.message : "UNKNOWN"
  if (msg === "NOT_FOUND") {
    res.status(404).json({ error: "ticket not found" })
    return
  }
  if (msg === "EXPIRED") {
    res.status(410).json({ error: "ticket expired" })
    return
  }
  if (msg === "INVALID_CODE") {
    res.status(400).json({ error: "รูปแบบรหัสไม่ถูกต้อง" })
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
  res.status(400).json({ error: "preview failed" })
}

export async function getKioskDisplaySession(_req: Request, res: Response) {
  let cabinetOnline = false
  try {
    cabinetOnline = await isCabinetOnline()
  } catch {
    cabinetOnline = false
  }

  res.json(getCabinetSessionSnapshot(cabinetOnline))
}

export async function postKioskDisplayScanStart(_req: Request, res: Response) {
  let cabinetOnline = false
  try {
    cabinetOnline = await isCabinetOnline()
  } catch {
    cabinetOnline = false
  }

  if (!cabinetOnline) {
    res.status(503).json({ error: "kiosk offline" })
    return
  }

  try {
    const command = queueDisplayScanStart()
    res.status(202).json({ ok: true, command: { id: command.id, action: command.action } })
  } catch (err) {
    mapCommandError(res, err)
  }
}

export async function postKioskDisplayScanCancel(_req: Request, res: Response) {
  try {
    const command = queueDisplayScanCancel()
    res.status(202).json({ ok: true, command: { id: command.id, action: command.action } })
  } catch (err) {
    mapCommandError(res, err)
  }
}

export async function postKioskDisplayConfirm(_req: Request, res: Response) {
  let cabinetOnline = false
  try {
    cabinetOnline = await isCabinetOnline()
  } catch {
    cabinetOnline = false
  }

  if (!cabinetOnline) {
    res.status(503).json({ error: "kiosk offline" })
    return
  }

  if (isCabinetPreviewExpired()) {
    res.status(410).json({ error: "ticket expired" })
    return
  }

  try {
    const command = queueDisplayConfirmPickup()
    res.status(202).json({ ok: true, command: { id: command.id, action: command.action } })
  } catch (err) {
    mapCommandError(res, err)
  }
}

export async function postKioskDisplaySubmitCode(req: Request, res: Response) {
  let cabinetOnline = false
  try {
    cabinetOnline = await isCabinetOnline()
  } catch {
    cabinetOnline = false
  }

  if (!cabinetOnline) {
    res.status(503).json({ error: "kiosk offline" })
    return
  }

  const body = req.body as { code?: string }
  const code = String(body.code ?? "").trim().toUpperCase()
  if (!code) {
    res.status(400).json({ error: "code required" })
    return
  }

  try {
    const preview = await previewPickupTicket(code)
    setCabinetPreviewFromTablet(preview)

    const command = queueDisplaySubmitCode(code)
    res.status(202).json({
      ok: true,
      preview,
      command: { id: command.id, action: command.action },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN"
    if (msg === "COMMAND_IN_PROGRESS") {
      mapCommandError(res, err)
      return
    }
    mapPickupPreviewError(res, err)
  }
}

export async function postKioskSessionSync(req: Request, res: Response) {
  const secret = process.env.KIOSK_HEARTBEAT_SECRET?.trim()
  const provided = String(req.headers["x-kiosk-secret"] || "").trim()

  if (!secret || provided !== secret) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const body = req.body as {
    phase?: unknown
    countdownSec?: unknown
    camOnline?: unknown
    camPreviewUrl?: unknown
    dispenseBusy?: unknown
    error?: unknown
    preview?: unknown
  }

  syncCabinetSession(body)
  res.json({ ok: true })
}