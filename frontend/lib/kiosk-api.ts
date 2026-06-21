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
  camPreviewUrl?: string
  dispenseBusy?: boolean
  error?: string
  preview?: KioskPreview
  connected?: boolean
}

const PRODUCTION_API_URL = "https://khrong-ngan.onrender.com"

function isLanKioskMode(): boolean {
  return process.env.NEXT_PUBLIC_KIOSK_MODE === "lan"
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1"
}

function getCloudApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")

  if (typeof window !== "undefined") {
    const host = window.location.hostname
    if (host.endsWith(".vercel.app") || (host && !isLocalHostname(host))) {
      return PRODUCTION_API_URL
    }
    if (isLocalHostname(host)) {
      return configured || "http://localhost:4000"
    }
  }

  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return PRODUCTION_API_URL
  }

  return configured || "http://localhost:4000"
}

function getLanS3Base(): string {
  return (
    process.env.NEXT_PUBLIC_KIOSK_S3_URL || "http://192.168.1.100"
  ).replace(/\/$/, "")
}

function apiBase(): string {
  return isLanKioskMode() ? getLanS3Base() : getCloudApiBase()
}

export function getKioskApiBase(): string {
  return getCloudApiBase()
}

export function getKioskCameraFrameUrl(): string {
  return `${getCloudApiBase()}/api/kiosk/display/camera-frame`
}

function sessionPath(): string {
  return isLanKioskMode()
    ? "/kiosk/session"
    : "/api/kiosk/display/session"
}

function scanStartPath(): string {
  return isLanKioskMode()
    ? "/kiosk/scan/start"
    : "/api/kiosk/display/scan/start"
}

function scanCancelPath(): string {
  return isLanKioskMode()
    ? "/kiosk/scan/cancel"
    : "/api/kiosk/display/scan/cancel"
}

function confirmPath(): string {
  return isLanKioskMode()
    ? "/kiosk/pickup/confirm"
    : "/api/kiosk/display/confirm"
}

async function kioskFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
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
  return kioskFetch<KioskSession>(sessionPath())
}

export async function startKioskScan(): Promise<{ ok: boolean }> {
  try {
    return await kioskFetch<{ ok: boolean }>(scanStartPath(), { method: "POST" })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (msg.includes("command in progress")) {
      return { ok: true }
    }
    throw e
  }
}

export function cancelKioskScan(): Promise<{ ok: boolean }> {
  return kioskFetch(scanCancelPath(), { method: "POST" })
}

export function confirmKioskPickup(): Promise<{ ok: boolean }> {
  return kioskFetch(confirmPath(), { method: "POST" })
}
