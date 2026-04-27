"use client"

import { useEffect, useState } from "react"
import { Pill } from "lucide-react"
import { Progress } from "@/components/ui/progress"

const MIN_LOADING_MS = 1500

export default function LocaleLoading() {
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    const startedAt = Date.now()
    let raf = 0

    const tick = () => {
      const elapsed = Date.now() - startedAt
      const progress = Math.min(1, elapsed / MIN_LOADING_MS)
      setPercent(Math.round(progress * 100))
      if (progress < 1) {
        raf = window.requestAnimationFrame(tick)
      }
    }

    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="flex min-h-[calc(100dvh-60px)] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-3">
            <Pill className="h-6 w-6 animate-spin text-primary [animation-duration:1.2s]" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Loading LaneYa</p>
            <p className="text-xl font-bold tabular-nums text-foreground">{percent}%</p>
            <p className="text-xs text-muted-foreground">minimum 1.5s</p>
          </div>
        </div>
        <Progress value={percent} className="h-2.5" />
      </div>
    </div>
  )
}
