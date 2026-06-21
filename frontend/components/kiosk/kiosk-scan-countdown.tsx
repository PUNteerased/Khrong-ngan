"use client"

import type { KioskMessages } from "@/lib/kiosk-i18n"
import { KioskCameraViewport } from "@/components/kiosk/kiosk-camera-viewport"
import { KIOSK_SCAN_DURATION_SEC } from "@/lib/kiosk-constants"
import { useSmoothCountdown } from "@/hooks/use-smooth-countdown"

type Props = {
  t: KioskMessages
  seconds: number
  camOnline?: boolean
  camPreviewUrl?: string
}

export function KioskScanCountdown({
  t,
  seconds,
  camOnline,
  camPreviewUrl,
}: Props) {
  const displaySeconds = useSmoothCountdown(seconds, true)

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
      <KioskCameraViewport
        t={t}
        active
        camPreviewUrl={camPreviewUrl}
        camOnline={camOnline}
      />
      <p className="text-xl font-semibold text-primary">{t.cameraOn}</p>
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
        className="flex h-28 w-28 items-center justify-center rounded-full border-8 border-primary/20 bg-primary/5 text-[4rem] font-bold tabular-nums text-primary"
        aria-live="polite"
      >
        {displaySeconds}
      </div>
      <div className="h-3 w-48 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-1000 ease-linear"
          style={{
            width: `${Math.max(0, (displaySeconds / KIOSK_SCAN_DURATION_SEC) * 100)}%`,
          }}
        />
      </div>
    </div>
  )
}
