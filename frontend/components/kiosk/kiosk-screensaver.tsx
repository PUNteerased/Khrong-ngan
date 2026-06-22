"use client"

import { AppLogo } from "@/components/app-logo"
import type { KioskMessages } from "@/lib/kiosk-i18n"

type Props = {
  t: KioskMessages
  onWake: () => void
}

export function KioskScreensaver({ t, onWake }: Props) {
  return (
    <button
      type="button"
      onClick={onWake}
      className="flex h-[100dvh] w-full flex-col items-center justify-center gap-8 bg-[#023c75] px-6 text-white"
    >
      <AppLogo size={120} className="rounded-2xl shadow-lg" priority />
      <div className="space-y-2 text-center">
        <p className="text-[clamp(2rem,6vw,3rem)] font-bold">{t.title}</p>
        <p className="animate-pulse text-[clamp(1.1rem,3vw,1.5rem)] text-white/90">
          {t.screensaverTap}
        </p>
      </div>
    </button>
  )
}
