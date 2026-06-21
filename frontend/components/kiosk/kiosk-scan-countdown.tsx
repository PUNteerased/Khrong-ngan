"use client"

import type { KioskMessages } from "@/lib/kiosk-i18n"

type Props = {
  t: KioskMessages
  seconds: number
  camOnline?: boolean
}

export function KioskScanCountdown({ t, seconds, camOnline }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-2xl font-semibold text-primary">{t.cameraOn}</p>
      <p
        className={
          camOnline === false
            ? "text-lg font-medium text-destructive"
            : "text-lg text-muted-foreground"
        }
      >
        {camOnline === false ? t.camOffline : camOnline ? t.camOnline : t.scanHint}
      </p>
      <div
        className="flex h-40 w-40 items-center justify-center rounded-full border-8 border-primary/20 bg-primary/5 text-[5rem] font-bold tabular-nums text-primary"
        aria-live="polite"
      >
        {seconds}
      </div>
      <div className="h-3 w-48 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${Math.max(0, (seconds / 45) * 100)}%` }}
        />
      </div>
    </div>
  )
}
