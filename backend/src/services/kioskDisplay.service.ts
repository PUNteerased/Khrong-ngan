export type KioskDisplayPhase =
  | "idle"
  | "scanning"
  | "preview"
  | "dispensing"
  | "success"
  | "error"

export type KioskDisplayPreview = {
  ok: boolean
  code: string
  slotId: string
  channel: number
  quantity: number
  riskLevel?: string
  expiresAt: string
  sessionSummary?: string
  drug: {
    name: string
    genericName?: string | null
    brandNameEn?: string | null
    imageUrl?: string | null
    warnings?: string | null
    contraindications?: string | null
    indication?: string | null
  }
}

export type KioskDisplaySession = {
  phase: KioskDisplayPhase
  countdownSec: number
  camOnline?: boolean
  camPreviewUrl?: string
  dispenseBusy?: boolean
  error?: string
  preview?: KioskDisplayPreview
  connected: boolean
  updatedAt: string
}

const VALID_PHASES = new Set<KioskDisplayPhase>([
  "idle",
  "scanning",
  "preview",
  "dispensing",
  "success",
  "error",
])

let cabinetSession: Omit<KioskDisplaySession, "connected"> = {
  phase: "idle",
  countdownSec: 0,
  updatedAt: new Date().toISOString(),
}

/** Prevents S3 idle heartbeat from overwriting tablet-initiated preview. */
let displayLockUntilMs = 0

export function setCabinetDisplayLock(durationMs = 8000): void {
  displayLockUntilMs = Date.now() + durationMs
}

export function isCabinetPreviewExpired(): boolean {
  const expiresAt = cabinetSession.preview?.expiresAt
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() <= Date.now()
}

function normalizePhase(raw: unknown): KioskDisplayPhase {
  const p = String(raw ?? "idle").trim().toLowerCase()
  if (VALID_PHASES.has(p as KioskDisplayPhase)) {
    return p as KioskDisplayPhase
  }
  return "idle"
}

export function syncCabinetSession(body: {
  phase?: unknown
  countdownSec?: unknown
  camOnline?: unknown
  camPreviewUrl?: unknown
  dispenseBusy?: unknown
  error?: unknown
  preview?: unknown
}): void {
  const incomingPhase = normalizePhase(body.phase)
  if (
    displayLockUntilMs > Date.now() &&
    incomingPhase === "idle" &&
    cabinetSession.phase === "preview"
  ) {
    return
  }

  const phase = incomingPhase
  const countdownSec = Number.isFinite(Number(body.countdownSec))
    ? Math.max(0, Math.floor(Number(body.countdownSec)))
    : 0

  const next: Omit<KioskDisplaySession, "connected"> = {
    phase,
    countdownSec,
    camOnline:
      typeof body.camOnline === "boolean" ? body.camOnline : undefined,
    camPreviewUrl:
      typeof body.camPreviewUrl === "string" && body.camPreviewUrl.trim()
        ? body.camPreviewUrl.trim()
        : undefined,
    dispenseBusy:
      typeof body.dispenseBusy === "boolean" ? body.dispenseBusy : undefined,
    updatedAt: new Date().toISOString(),
  }

  if (phase === "error" && typeof body.error === "string" && body.error.trim()) {
    next.error = body.error.trim()
  }

  if (phase === "preview" && body.preview && typeof body.preview === "object") {
    next.preview = body.preview as KioskDisplayPreview
  }

  if (phase !== "scanning") {
    next.camPreviewUrl = undefined
  }

  cabinetSession = next
}

export function getCabinetSessionSnapshot(
  cabinetOnline: boolean
): KioskDisplaySession {
  return {
    ...cabinetSession,
    connected: cabinetOnline,
  }
}

export function resetCabinetSessionDisplay(): void {
  cabinetSession = {
    phase: "idle",
    countdownSec: 0,
    updatedAt: new Date().toISOString(),
  }
  displayLockUntilMs = 0
}

export function setCabinetPreviewFromTablet(
  preview: KioskDisplayPreview
): void {
  cabinetSession = {
    phase: "preview",
    countdownSec: 0,
    preview,
    updatedAt: new Date().toISOString(),
  }
  setCabinetDisplayLock()
}
