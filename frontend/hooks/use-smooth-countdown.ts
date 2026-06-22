"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Smooth 1s ticks between server polls (session poll is ~600ms).
 * Re-syncs end time when server value jumps (new scan or drift).
 */
export function useSmoothCountdown(serverSeconds: number, active: boolean): number {
  const endAtRef = useRef(0)
  const [display, setDisplay] = useState(serverSeconds)

  useEffect(() => {
    if (!active) {
      endAtRef.current = 0
      setDisplay(0)
      return
    }

    if (serverSeconds <= 0) {
      endAtRef.current = 0
      setDisplay(0)
      return
    }

    const now = Date.now()
    const proposedEnd = now + serverSeconds * 1000
    const prevEnd = endAtRef.current

    if (
      !prevEnd ||
      serverSeconds >= Math.ceil((prevEnd - now) / 1000) + 2 ||
      proposedEnd > prevEnd + 1500
    ) {
      endAtRef.current = proposedEnd
    } else {
      endAtRef.current = proposedEnd
    }

    setDisplay(Math.max(0, Math.ceil((endAtRef.current - now) / 1000)))
  }, [serverSeconds, active])

  useEffect(() => {
    if (!active) return

    const id = window.setInterval(() => {
      if (!endAtRef.current) return
      setDisplay(Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000)))
    }, 250)

    return () => window.clearInterval(id)
  }, [active])

  return display
}
