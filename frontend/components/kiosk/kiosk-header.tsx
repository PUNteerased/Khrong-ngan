"use client"

import { AppLogo } from "@/components/app-logo"
import { cn } from "@/lib/utils"
import type { KioskLocale } from "@/lib/kiosk-api"
import type { KioskMessages } from "@/lib/kiosk-i18n"
import { Volume2, VolumeX } from "lucide-react"

type Props = {
  locale: KioskLocale
  t: KioskMessages
  ttsOn: boolean
  onLocaleChange: (locale: KioskLocale) => void
  onTtsToggle: () => void
}

export function KioskHeader({
  locale,
  t,
  ttsOn,
  onLocaleChange,
  onTtsToggle,
}: Props) {
  return (
    <header className="flex min-h-[8vh] shrink-0 items-center justify-between bg-[#023c75] px-4 py-2 text-white safe-top">
      <div className="flex items-center gap-3">
        <AppLogo size={40} className="rounded-md" priority />
        <span className="text-[clamp(1.25rem,3.5vw,1.75rem)] font-bold leading-tight">
          {t.title}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex overflow-hidden rounded-xl border border-white/30 text-lg font-semibold">
          <button
            type="button"
            onClick={() => onLocaleChange("th")}
            className={cn(
              "min-h-12 min-w-14 px-3",
              locale === "th" ? "bg-white text-[#023c75]" : "text-white"
            )}
          >
            {t.langTh}
          </button>
          <button
            type="button"
            onClick={() => onLocaleChange("en")}
            className={cn(
              "min-h-12 min-w-14 px-3",
              locale === "en" ? "bg-white text-[#023c75]" : "text-white"
            )}
          >
            {t.langEn}
          </button>
        </div>
        <button
          type="button"
          onClick={onTtsToggle}
          aria-pressed={ttsOn}
          className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-3 text-xl"
          title={ttsOn ? t.ttsOff : t.ttsOn}
        >
          {ttsOn ? <Volume2 className="h-7 w-7" /> : <VolumeX className="h-7 w-7" />}
          <span className="sr-only">{ttsOn ? t.ttsOff : t.ttsOn}</span>
        </button>
      </div>
    </header>
  )
}
