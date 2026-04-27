import type { Request, Response } from "express"
import axios from "axios"
import { prisma } from "../lib/prisma.js"

export async function getAdminHealth(_req: Request, res: Response) {
  let database = false
  try {
    await prisma.$queryRaw`SELECT 1`
    database = true
  } catch {
    database = false
  }

  let dify: "ok" | "missing_key" | "error" = "missing_key"
  const apiKey = process.env.DIFY_API_KEY?.trim()
  const base = (process.env.DIFY_API_BASE || "https://api.dify.ai/v1").replace(
    /\/$/,
    ""
  )

  if (!apiKey) {
    dify = "missing_key"
  } else {
    try {
      const r = await axios.get(`${base}/parameters`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 8000,
        validateStatus: (s) => s >= 200 && s < 500,
      })
      if (r.status === 401 || r.status === 403) dify = "error"
      else dify = "ok"
    } catch {
      dify = "error"
    }
  }

  let cabinet = false
  const cabinetHealthUrl = process.env.CABINET_HEALTH_URL?.trim()
  if (cabinetHealthUrl) {
    try {
      const r = await axios.get(cabinetHealthUrl, {
        timeout: 5000,
        validateStatus: (s) => s >= 200 && s < 500,
      })
      cabinet = r.status >= 200 && r.status < 300
    } catch {
      cabinet = false
    }
  }

  res.json({
    database,
    dify,
    cabinet,
    timestamp: new Date().toISOString(),
  })
}
