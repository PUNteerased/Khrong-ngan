"use client"

import { useMemo, useState } from "react"
import type { KioskMessages } from "@/lib/kiosk-i18n"
import { parseCompactTicketCode, stripTicketCodeInput } from "@/lib/ticket-code"

type Props = {
  t: KioskMessages
  onSubmit: (code: string) => void
  loading?: boolean
  disabled?: boolean
  disabledReason?: string
  compact?: boolean
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

  const parsedCode = useMemo(() => parseCompactTicketCode(code), [code])
  const canSubmit = Boolean(parsedCode)

  const handleSubmit = () => {
    if (!parsedCode) return
    onSubmit(parsedCode)
  }

  const handleChange = (raw: string) => {
    setCode(stripTicketCodeInput(raw))
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
        maxLength={14}
        value={code}
        disabled={loading || disabled}
        placeholder={t.codeEntryPlaceholder}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit()
        }}
        className="w-full rounded-xl border-2 border-border bg-background px-4 py-4 text-center font-mono text-[clamp(1rem,3vw,1.35rem)] tracking-wide outline-none focus:border-primary disabled:opacity-60"
      />
      <p className="text-center font-mono text-sm text-muted-foreground">
        {t.codeEntryHint}
      </p>
      {disabled && disabledReason ? (
        <p className="text-center text-sm text-destructive">{disabledReason}</p>
      ) : null}
      <button
        type="button"
        disabled={loading || disabled || !canSubmit}
        onClick={handleSubmit}
        className="w-full rounded-xl bg-secondary px-4 py-4 text-center text-lg font-semibold text-secondary-foreground transition-opacity disabled:opacity-60"
      >
        {loading ? "…" : t.codeEntrySubmit}
      </button>
    </div>
  )
}
