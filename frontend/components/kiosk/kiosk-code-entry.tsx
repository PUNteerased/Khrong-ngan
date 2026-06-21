"use client"

import { useState } from "react"
import type { KioskMessages } from "@/lib/kiosk-i18n"

type Props = {
  t: KioskMessages
  onSubmit: (code: string) => void
  loading?: boolean
  disabled?: boolean
  disabledReason?: string
  compact?: boolean
}

function normalizeCodeInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "")
}

export function KioskCodeEntry({
  t,
  onSubmit,
  loading,
  disabled,
  disabledReason,
  compact,
}: Props) {
  const [code, setCode] = useState("")

  const handleSubmit = () => {
    const normalized = normalizeCodeInput(code)
    if (!normalized) return
    onSubmit(normalized)
  }

  return (
    <div
      className={
        compact
          ? "w-full max-w-md space-y-3"
          : "w-full max-w-xl space-y-3 rounded-2xl bg-card p-5 shadow-lg"
      }
    >
      {!compact ? (
        <p className="text-center text-sm font-medium text-muted-foreground">
          {t.codeEntryOr}
        </p>
      ) : null}
      <label className="block text-center text-base font-medium text-muted-foreground">
        {t.codeEntryLabel}
      </label>
      <input
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        value={code}
        disabled={loading || disabled}
        placeholder={t.codeEntryPlaceholder}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit()
        }}
        className="w-full rounded-xl border-2 border-border bg-background px-4 py-4 text-center font-mono text-[clamp(1rem,3vw,1.35rem)] tracking-wide outline-none focus:border-primary disabled:opacity-60"
      />
      {disabled && disabledReason ? (
        <p className="text-center text-sm text-destructive">{disabledReason}</p>
      ) : null}
      <button
        type="button"
        disabled={loading || disabled || !normalizeCodeInput(code)}
        onClick={handleSubmit}
        className="w-full rounded-xl bg-secondary px-4 py-4 text-center text-lg font-semibold text-secondary-foreground transition-opacity disabled:opacity-60"
      >
        {loading ? "…" : t.codeEntrySubmit}
      </button>
    </div>
  )
}
