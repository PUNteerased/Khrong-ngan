"use client"

import { useEffect, useRef } from "react"

type Options = {
  enabled: boolean
  timeoutMs: number
  onTimeout: () => void
}

export function useKioskInactivity({ enabled, timeoutMs, onTimeout }: Options) {
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  useEffect(() => {
    if (!enabled) return

    let timer = window.setTimeout(() => onTimeoutRef.current(), timeoutMs)

    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => onTimeoutRef.current(), timeoutMs)
    }

    window.addEventListener("pointerdown", reset)
    window.addEventListener("touchstart", reset)
    window.addEventListener("keydown", reset)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("pointerdown", reset)
      window.removeEventListener("touchstart", reset)
      window.removeEventListener("keydown", reset)
    }
  }, [enabled, timeoutMs])
}
