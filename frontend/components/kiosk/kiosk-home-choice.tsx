"use client"

import { QrCode, Keyboard } from "lucide-react"
import type { KioskMessages } from "@/lib/kiosk-i18n"
import { KioskHelpDialog } from "@/components/kiosk/kiosk-help-dialog"
import type { KioskSessionPhase } from "@/lib/kiosk-api"

type Props = {
  t: KioskMessages
  onOpenScan: () => void
  onOpenCode: () => void
  scanLoading?: boolean
  scanDisabled?: boolean
  codeDisabled?: boolean
  disabledReason?: string
  phase?: KioskSessionPhase
  camOnline?: boolean
}

export function KioskHomeChoice({
  t,
  onOpenScan,
  onOpenCode,
  scanLoading,
  scanDisabled,
  codeDisabled,
  disabledReason,
  phase,
  camOnline,
}: Props) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-8 px-4 py-6">
      <div className="space-y-2 text-center">
        <h2 className="text-[clamp(1.75rem,5vw,2.5rem)] font-bold text-foreground">
          {t.homeTitle}
        </h2>
        {disabledReason && (scanDisabled || codeDisabled) ? (
          <p className="text-sm text-destructive">{disabledReason}</p>
        ) : null}
      </div>

      <div className="flex w-full max-w-xl flex-col gap-4">
        <button
          type="button"
          disabled={scanLoading || scanDisabled}
          onClick={onOpenScan}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#023c75] px-6 py-6 text-[clamp(1.25rem,4vw,1.75rem)] font-bold text-white shadow-lg transition-opacity disabled:opacity-60"
        >
          <QrCode className="h-8 w-8 shrink-0" />
          {t.homeScanBtn}
        </button>
        <button
          type="button"
          disabled={codeDisabled}
          onClick={onOpenCode}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-[#023c75] bg-card px-6 py-6 text-[clamp(1.25rem,4vw,1.75rem)] font-bold text-[#023c75] shadow-md transition-opacity disabled:opacity-60"
        >
          <Keyboard className="h-8 w-8 shrink-0" />
          {t.homeCodeBtn}
        </button>
      </div>

      <KioskHelpDialog t={t} phase={phase} camOnline={camOnline} />
    </div>
  )
}
