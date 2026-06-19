import axios from "axios"

export type KioskStatusPayload = {
  online: boolean
  lat: number
  lng: number
  name: string
  device: string
  firmwareVersion: string | null
  rssi: number | null
  lastSeen: string | null
  source: "heartbeat" | "health_url" | "default"
}

type HeartbeatRecord = {
  lat: number
  lng: number
  name: string
  device: string
  firmwareVersion: string | null
  rssi: number | null
  at: Date
}

let lastHeartbeat: HeartbeatRecord | null = null

const HEARTBEAT_TTL_MS = 3 * 60 * 1000

function defaultLat(): number {
  const raw = process.env.KIOSK_LAT?.trim()
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) ? n : 17.0075
}

function defaultLng(): number {
  const raw = process.env.KIOSK_LNG?.trim()
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) ? n : 99.8260
}

function defaultName(): string {
  return process.env.KIOSK_NAME?.trim() || "LaneYa Kiosk"
}

export function recordKioskHeartbeat(body: {
  lat?: number
  lng?: number
  name?: string
  device?: string
  firmwareVersion?: string
  rssi?: number
}): void {
  lastHeartbeat = {
    lat: Number.isFinite(body.lat) ? Number(body.lat) : defaultLat(),
    lng: Number.isFinite(body.lng) ? Number(body.lng) : defaultLng(),
    name: body.name?.trim() || defaultName(),
    device: body.device?.trim() || "esp32-s3",
    firmwareVersion: body.firmwareVersion?.trim() || null,
    rssi: Number.isFinite(body.rssi) ? Number(body.rssi) : null,
    at: new Date(),
  }
}

function heartbeatFresh(): HeartbeatRecord | null {
  if (!lastHeartbeat) return null
  if (Date.now() - lastHeartbeat.at.getTime() > HEARTBEAT_TTL_MS) return null
  return lastHeartbeat
}

async function probeCabinetHealthUrl(): Promise<{
  online: boolean
  lat?: number
  lng?: number
  name?: string
  device?: string
  firmwareVersion?: string
} | null> {
  const base = process.env.CABINET_HEALTH_URL?.trim()
  if (!base) return null

  const urls = [
    base.replace(/\/$/, "") + "/status",
    base.replace(/\/$/, ""),
  ]

  for (const url of urls) {
    try {
      const res = await axios.get(url, {
        timeout: 4000,
        validateStatus: (s) => s >= 200 && s < 500,
      })
      if (res.status < 200 || res.status >= 300) continue

      const data = res.data as Record<string, unknown> | null
      if (data && typeof data === "object") {
        return {
          online: data.online !== false,
          lat: typeof data.lat === "number" ? data.lat : undefined,
          lng: typeof data.lng === "number" ? data.lng : undefined,
          name: typeof data.name === "string" ? data.name : undefined,
          device: typeof data.device === "string" ? data.device : undefined,
          firmwareVersion:
            typeof data.firmwareVersion === "string"
              ? data.firmwareVersion
              : typeof data.firmware === "string"
                ? data.firmware
                : undefined,
        }
      }
      return { online: true }
    } catch {
      continue
    }
  }
  return { online: false }
}

export async function getKioskStatus(): Promise<KioskStatusPayload> {
  const fresh = heartbeatFresh()
  if (fresh) {
    return {
      online: true,
      lat: fresh.lat,
      lng: fresh.lng,
      name: fresh.name,
      device: fresh.device,
      firmwareVersion: fresh.firmwareVersion,
      rssi: fresh.rssi,
      lastSeen: fresh.at.toISOString(),
      source: "heartbeat",
    }
  }

  const probed = await probeCabinetHealthUrl()
  if (probed) {
    return {
      online: probed.online,
      lat: probed.lat ?? defaultLat(),
      lng: probed.lng ?? defaultLng(),
      name: probed.name ?? defaultName(),
      device: probed.device ?? "esp32-s3",
      firmwareVersion: probed.firmwareVersion ?? null,
      rssi: null,
      lastSeen: lastHeartbeat?.at.toISOString() ?? null,
      source: "health_url",
    }
  }

  return {
    online: false,
    lat: defaultLat(),
    lng: defaultLng(),
    name: defaultName(),
    device: "esp32-s3",
    firmwareVersion: null,
    rssi: null,
    lastSeen: lastHeartbeat?.at.toISOString() ?? null,
    source: "default",
  }
}

export async function isCabinetOnline(): Promise<boolean> {
  const status = await getKioskStatus()
  return status.online
}
