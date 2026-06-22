"use client"

import { useCallback, useState } from "react"
import { KioskFloatingPills } from "@/components/kiosk/kiosk-floating-pills"
import { KioskMascotCapsi } from "@/components/kiosk/kiosk-mascot-capsi"
import type { KioskMessages } from "@/lib/kiosk-i18n"

const WAKE_ANIMATION_MS = 450

type Props = {
  t: KioskMessages
  onWake: () => void
}

export function KioskScreensaver({ t, onWake }: Props) {
  const [waking, setWaking] = useState(false)

  const handleWake = useCallback(() => {
    if (waking) return
    setWaking(true)
    window.setTimeout(() => onWake(), WAKE_ANIMATION_MS)
  }, [onWake, waking])

  return (
    <button
      type="button"
      onClick={handleWake}
      disabled={waking}
      aria-label={t.screensaverTap}
      className="flex h-[100dvh] w-full flex-col items-center justify-center gap-6 bg-[#023c75] px-6 text-white disabled:cursor-default"
    >
      <p className="text-[clamp(2rem,6vw,3rem)] font-bold">{t.title}</p>

      <div className="relative flex items-center justify-center">
        <KioskFloatingPills />
        <KioskMascotCapsi
          variant={waking ? "happy" : "idle"}
          celebrating={waking}
        />
      </div>

      <p className="animate-pulse text-[clamp(1.1rem,3vw,1.5rem)] text-white/90">
        {t.screensaverTap}
      </p>
    </button>
  )
}
