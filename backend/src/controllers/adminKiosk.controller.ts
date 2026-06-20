import type { Request, Response } from "express"
import { isCabinetOnline } from "../services/kioskStatus.service.js"
import {
  getCommandStatus,
  queueServoTest,
} from "../services/kioskCommand.service.js"

export async function postAdminServoTest(req: Request, res: Response) {
  const body = req.body as { slot?: number }
  const slot = Number(body.slot)

  try {
    const command = queueServoTest(slot)
    res.status(201).json({ command })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN"
    if (msg === "INVALID_SLOT") {
      res.status(400).json({ error: "ช่องมอเตอร์ไม่ถูกต้อง (0–9)" })
      return
    }
    if (msg === "COMMAND_IN_PROGRESS") {
      res.status(409).json({ error: "มีคำสั่งทดสอบค้างอยู่ รอตู้ดำเนินการก่อน" })
      return
    }
    res.status(500).json({ error: "ไม่สามารถส่งคำสั่งได้" })
  }
}

export async function getAdminServoTestStatus(_req: Request, res: Response) {
  let cabinetOnline = false
  try {
    cabinetOnline = await isCabinetOnline()
  } catch {
    cabinetOnline = false
  }

  res.json({
    cabinetOnline,
    command: getCommandStatus(),
  })
}
