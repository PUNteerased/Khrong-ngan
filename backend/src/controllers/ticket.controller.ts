import type { Request, Response } from "express"
import { getTicketStatusForUser } from "../services/pickupTicket.service.js"

export async function getTicketStatus(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const code = String(req.params.code ?? "").trim()
  if (!code) {
    res.status(400).json({ error: "code required" })
    return
  }

  const status = await getTicketStatusForUser(code, req.auth.userId)
  if (!status) {
    res.status(404).json({ error: "ไม่พบตั๋ว" })
    return
  }

  res.json(status)
}
