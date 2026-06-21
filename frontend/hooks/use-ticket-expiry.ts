"use client"

import { useEffect, useState } from "react"

export function useTicketExpiry(expiresAt: string | undefined): {
  secondsLeft: number
  expired: boolean
} {
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(0)
      return
    }

    const tick = () => {
      const remaining = Math.ceil(
        (new Date(expiresAt).getTime() - Date.now()) / 1000
      )
      setSecondsLeft(Math.max(0, remaining))
    }

    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [expiresAt])

  return {
    secondsLeft,
    expired: Boolean(expiresAt) && secondsLeft <= 0,
  }
}

function formatExpiryMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export function formatTicketExpiryCountdown(totalSeconds: number): string {
  return formatExpiryMmSs(totalSeconds)
}
