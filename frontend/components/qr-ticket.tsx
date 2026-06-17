"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import QRCode from "react-qr-code"
import { useTranslations } from "next-intl"
import { AlertTriangle, Download, Home, Pill } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AppLogo } from "@/components/app-logo"
import type { DrugDto } from "@/lib/api"
import { cn } from "@/lib/utils"

type Props = {
  drug: DrugDto
  quantity: number
  ticketCode: string
  expiresAt: Date
  onClose?: () => void
  className?: string
}

function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

function useCountdown(target: Date, onExpire?: () => void) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000))
  )
  const expiredRef = useRef(false)

  useEffect(() => {
    expiredRef.current = false
    setRemaining(Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000)))
    const id = window.setInterval(() => {
      const next = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000))
      setRemaining(next)
      if (next <= 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpire?.()
        window.clearInterval(id)
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [target, onExpire])

  return remaining
}

export function QRTicket({
  drug,
  quantity,
  ticketCode,
  expiresAt,
  onClose,
  className,
}: Props) {
  const t = useTranslations("QRTicket")
  const qrWrapperRef = useRef<HTMLDivElement>(null)

  const remaining = useCountdown(expiresAt, onClose)
  const lowTime = remaining > 0 && remaining <= 60
  const expired = remaining <= 0

  const payload = useMemo(
    () =>
      JSON.stringify({
        v: 1,
        code: ticketCode,
        drugId: drug.id,
        slotId: drug.slotId,
        qty: quantity,
        expiresAt: expiresAt.toISOString(),
      }),
    [ticketCode, drug.id, drug.slotId, quantity, expiresAt]
  )

  const handleDownload = () => {
    const svg = qrWrapperRef.current?.querySelector("svg")
    if (!svg) return
    const serializer = new XMLSerializer()
    const src = serializer.serializeToString(svg)
    const blob = new Blob([src], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `laneya-ticket-${ticketCode}.svg`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-md rounded-2xl border border-primary/20 bg-card shadow-lg",
        className
      )}
    >
      <div className="flex items-center gap-3 rounded-t-2xl bg-gradient-to-r from-primary to-primary/80 px-5 py-4 text-primary-foreground">
        <div className="rounded-full bg-white/90 p-1">
          <AppLogo size={32} className="rounded-full" />
        </div>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider opacity-90">LaneYa</p>
          <h2 className="text-lg font-semibold leading-tight">{t("title")}</h2>
        </div>
        <Badge className="bg-white/20 text-white hover:bg-white/30">
          #{ticketCode}
        </Badge>
      </div>

      <div className="flex flex-col items-center gap-4 px-5 py-6">
        <div
          ref={qrWrapperRef}
          className={cn(
            "rounded-xl border-4 p-3 transition-colors",
            expired
              ? "border-destructive/40 bg-destructive/5"
              : "border-primary/20 bg-white"
          )}
          aria-hidden={expired}
        >
          <QRCode
            value={payload}
            size={180}
            level="M"
            style={{ height: "auto", width: "180px" }}
          />
        </div>

        <div
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold tabular-nums",
            expired
              ? "bg-destructive/10 text-destructive"
              : lowTime
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "bg-primary/10 text-primary"
          )}
        >
          {expired ? t("expired") : t("expiresIn", { time: formatMMSS(remaining) })}
        </div>

        <div className="w-full space-y-3 rounded-xl bg-muted/50 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Pill className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground">{drug.name}</h3>
              {drug.category ? (
                <p className="text-xs text-muted-foreground">{drug.category}</p>
              ) : null}
            </div>
            <Badge variant="secondary" className="shrink-0">
              {t("slot", { slot: drug.slotId })}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-background p-3">
              <p className="text-xs text-muted-foreground">{t("qtyLabel")}</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {t("qtyUnit", { count: quantity })}
              </p>
            </div>
            <div className="rounded-lg bg-background p-3">
              <p className="text-xs text-muted-foreground">{t("dosageLabel")}</p>
              <p className="text-sm text-foreground">
                {drug.dosageNotes || t("noDosage")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex w-full items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("warning")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border px-5 py-4 sm:flex-row">
        <Button
          variant="outline"
          onClick={handleDownload}
          disabled={expired}
          className="sm:flex-1"
        >
          <Download className="mr-1 h-4 w-4" />
          {t("download")}
        </Button>
        <Button asChild className="sm:flex-1" onClick={onClose}>
          <Link href="/">
            <Home className="mr-1 h-4 w-4" />
            {t("backHome")}
          </Link>
        </Button>
      </div>
    </div>
  )
}
