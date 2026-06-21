"use client"

import type { KioskMessages } from "@/lib/kiosk-i18n"
import { KioskCameraViewport } from "@/components/kiosk/kiosk-camera-viewport"
import { KioskCountdownRing } from "@/components/kiosk/kiosk-countdown-ring"
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
    <div className="flex h-full flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-4 text-center">
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
      <KioskCountdownRing seconds={displaySeconds} />
    </div>
  )
}
