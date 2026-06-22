"use client"

import { Loader2, CheckCircle2 } from "lucide-react"
import type { KioskMessages } from "@/lib/kiosk-i18n"
import type { KioskSessionPhase } from "@/lib/kiosk-api"

type Props = {
  t: KioskMessages
  phase: KioskSessionPhase
  cancelDisabled?: boolean
  confirmDisabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function KioskBottomBar({
  t,
  phase,
  cancelDisabled,
  confirmDisabled,
  onCancel,
  onConfirm,
}: Props) {
  if (phase === "idle") return null

  if (phase === "scanning") {
    return (
      <footer className="flex min-h-[20vh] shrink-0 border-t bg-muted/30 px-4 py-4 safe-bottom">
        <button
          type="button"
          disabled={cancelDisabled}
          onClick={onCancel}
          className="flex w-full items-center justify-center rounded-xl bg-secondary px-4 py-4 text-lg font-semibold disabled:opacity-50"
        >
          {t.cancel}
        </button>
      </footer>
    )
  }

  return (
    <footer className="flex min-h-[20vh] shrink-0 gap-4 border-t bg-muted/30 px-4 py-4 safe-bottom">
      <button
        type="button"
        disabled={cancelDisabled}
        onClick={onCancel}
        className="flex flex-1 items-center justify-center rounded-xl bg-secondary px-4 py-4 text-lg font-semibold disabled:opacity-50"
      >
        {t.cancel}
      </button>
      <button
        type="button"
        disabled={confirmDisabled}
        onClick={onConfirm}
        className="flex flex-1 items-center justify-center rounded-xl bg-success px-4 py-4 text-xl font-bold text-success-foreground disabled:opacity-50"
      >
        {t.confirm}
      </button>
    </footer>
  )
}

export function KioskStatusOverlay({
  t,
  phase,
  errorMessage,
}: {
  t: KioskMessages
  phase: "dispensing" | "success" | "error"
  errorMessage?: string
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      {phase === "dispensing" && (
        <>
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <p className="text-2xl font-semibold">{t.dispensing}</p>
        </>
      )}
      {phase === "success" && (
        <>
          <CheckCircle2 className="h-24 w-24 text-success" />
          <p className="text-[clamp(1.5rem,4vw,2.25rem)] font-bold text-success">
            {t.success}
          </p>
        </>
      )}
      {phase === "error" && (
        <p className="text-xl font-semibold text-destructive">
          {errorMessage || t.error}
        </p>
      )}
    </div>
  )
}
