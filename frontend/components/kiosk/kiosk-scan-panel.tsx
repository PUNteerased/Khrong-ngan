"use client"

import Image from "next/image"
import type { KioskMessages } from "@/lib/kiosk-i18n"

type Props = {
  t: KioskMessages
  onOpenScan: () => void
  loading?: boolean
  disabled?: boolean
  disabledReason?: string
}

export function KioskScanPanel({
  t,
  onOpenScan,
  loading,
  disabled,
  disabledReason,
}: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-lg">
        <div className="mx-auto mb-4 flex justify-center">
          <Image
            src="/kiosk/scan-guide.svg"
            alt=""
            width={280}
            height={240}
            className="h-auto w-[70%] max-w-[280px] animate-pulse"
            priority
          />
        </div>
        <p className="text-center text-lg text-muted-foreground">{t.scanCaption}</p>
        {disabled && disabledReason ? (
          <p className="mt-2 text-center text-sm text-destructive">{disabledReason}</p>
        ) : null}
      </div>
      <button
        type="button"
        disabled={loading || disabled}
        onClick={onOpenScan}
        className="w-[80vw] max-w-xl rounded-2xl bg-[#023c75] px-6 py-5 text-center text-[clamp(1.25rem,4vw,2rem)] font-bold text-white shadow-lg transition-opacity disabled:opacity-60"
      >
        {t.openScan}
      </button>
    </div>
  )
}
