export type KioskLocale = "th" | "en"

export type KioskPreviewDrug = {
  name: string
  genericName?: string | null
  brandNameEn?: string | null
  imageUrl?: string | null
  warnings?: string | null
  contraindications?: string | null
  indication?: string | null
}

export type KioskPreview = {
  ok: boolean
  code: string
  slotId: string
  channel: number
  quantity: number
  riskLevel?: string
  expiresAt: string
  sessionSummary?: string
  drug: KioskPreviewDrug
}

export type KioskSessionPhase =
  | "idle"
  | "scanning"
  | "preview"
  | "dispensing"
  | "success"
  | "error"

export type KioskSession = {
  phase: KioskSessionPhase
  countdownSec: number
  camOnline?: boolean
  dispenseBusy?: boolean
  error?: string
  preview?: KioskPreview
}

const base = () =>
  (process.env.NEXT_PUBLIC_KIOSK_S3_URL || "http://192.168.1.100").replace(
    /\/$/,
    ""
  )

async function kioskFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  })
  if (!res.ok) {
    let detail = `${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) detail = body.error
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export function getKioskSession(): Promise<KioskSession> {
  return kioskFetch<KioskSession>("/kiosk/session")
}

export function startKioskScan(): Promise<{ ok: boolean }> {
  return kioskFetch("/kiosk/scan/start", { method: "POST" })
}

export function cancelKioskScan(): Promise<{ ok: boolean }> {
  return kioskFetch("/kiosk/scan/cancel", { method: "POST" })
}

export function confirmKioskPickup(): Promise<{ ok: boolean }> {
  return kioskFetch("/kiosk/pickup/confirm", { method: "POST" })
}
