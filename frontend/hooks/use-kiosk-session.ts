"use client"

import { useCallback, useEffect, useState } from "react"
import {
  getKioskSession,
  type KioskSession,
  type KioskSessionPhase,
} from "@/lib/kiosk-api"

export function useKioskSession(pollMs = 500) {
  const [session, setSession] = useState<KioskSession>({
    phase: "idle",
    countdownSec: 0,
  })
  const [connected, setConnected] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await getKioskSession()
      setSession(data)
      setConnected(true)
    } catch {
      setConnected(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), pollMs)
    return () => window.clearInterval(id)
  }, [pollMs, refresh])

  return { session, connected, refresh, phase: session.phase as KioskSessionPhase }
}
