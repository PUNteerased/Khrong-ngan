"use client"

import { ArrowLeft } from "lucide-react"
import type { KioskMessages } from "@/lib/kiosk-i18n"
import { KioskCodeEntry } from "@/components/kiosk/kiosk-code-entry"

type Props = {
  t: KioskMessages
  onSubmit: (code: string) => void
  onBack: () => void
  loading?: boolean
  disabled?: boolean
  disabledReason?: string
}

export function KioskCodeScreen({
  t,
  onSubmit,
  onBack,
  loading,
  disabled,
  disabledReason,
}: Props) {
  return (
    <div className="flex h-full flex-col px-4 py-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex w-fit items-center gap-2 rounded-lg px-2 py-2 text-lg font-medium text-muted-foreground hover:bg-muted"
      >
        <ArrowLeft className="h-6 w-6" />
        {t.codeBack}
      </button>
      <div className="flex flex-1 flex-col items-center justify-center">
        <h2 className="mb-6 text-center text-[clamp(1.5rem,4vw,2rem)] font-bold">
          {t.codeScreenTitle}
        </h2>
        <KioskCodeEntry
          t={t}
          onSubmit={onSubmit}
          loading={loading}
          disabled={disabled}
          disabledReason={disabledReason}
        />
      </div>
    </div>
  )
}
