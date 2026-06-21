"use client"

import { useCallback, useEffect, useState } from "react"
import {
  getKioskSession,
  type KioskSession,
  type KioskSessionPhase,
} from "@/lib/kiosk-api"

function isRateLimitedError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return err.message === "429" || err.message.toLowerCase().includes("too many")
}

function pollIntervalFor(phase: KioskSessionPhase): number {
  if (phase === "scanning" || phase === "preview" || phase === "dispensing") {
    return 600
  }
  return 1000
}

export function useKioskSession() {
  const [session, setSession] = useState<KioskSession>({
    phase: "idle",
    countdownSec: 0,
    connected: false,
  })
  const [connected, setConnected] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const data = await getKioskSession()
      setSession(data)
      setConnected(data.connected !== false)
    } catch (err) {
      if (isRateLimitedError(err)) return
      setConnected(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const pollMs = pollIntervalFor(session.phase as KioskSessionPhase)
    const id = window.setInterval(() => void refresh(), pollMs)
    return () => window.clearInterval(id)
  }, [session.phase, refresh])

  return { session, connected, refresh, phase: session.phase as KioskSessionPhase }
}
