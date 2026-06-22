"use client"

import { useCallback, useState } from "react"
import { cn } from "@/lib/utils"
import { KioskFloatingPills } from "@/components/kiosk/kiosk-floating-pills"
import { KioskMascotCapsi } from "@/components/kiosk/kiosk-mascot-capsi"
import type { KioskMessages } from "@/lib/kiosk-i18n"
import styles from "./kiosk-screensaver.module.css"

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
      className={cn(
        styles.root,
        waking && styles.waking,
        "flex h-[100dvh] w-full flex-col items-center justify-between px-6 py-10 text-white disabled:cursor-default sm:py-14",
      )}
    >
      {/* background texture */}
      <span className={styles.grid} aria-hidden />

      {/* Header */}
      <header className={cn(styles.content, "flex flex-col items-center gap-4")}>
        <span className={styles.badge} aria-hidden>
          <svg viewBox="0 0 32 32" width="30" height="30" fill="none">
            <rect x="5" y="11" width="22" height="10" rx="5" fill="#FFFFFF" />
            <rect x="5" y="11" width="11" height="10" rx="5" fill="#0B3C5D" />
          </svg>
        </span>
        <h1 className="text-center text-[clamp(2.25rem,7vw,3.5rem)] font-extrabold leading-tight tracking-tight text-balance">
          {t.title}
        </h1>
        <p className="text-[clamp(0.95rem,3vw,1.15rem)] font-medium tracking-[0.2em] text-sky-200/80 uppercase">
          Smart Medicine Dispenser
        </p>
      </header>

      {/* Mascot arena */}
      <div className={cn(styles.content, styles.arena)}>
        <KioskFloatingPills />
        <KioskMascotCapsi
          variant={waking ? "happy" : "idle"}
          celebrating={waking}
        />
      </div>

      {/* Call to action */}
      <div className={cn(styles.content, "flex flex-col items-center gap-4")}>
        <span className={styles.cta}>
          <span className="flex items-center gap-3">
            <span className={styles.dot} aria-hidden />
            <span className="text-[clamp(1.25rem,4.2vw,1.85rem)] font-bold tracking-tight">
              {t.screensaverTap}
            </span>
          </span>
        </span>
      </div>
    </button>
  )
}
