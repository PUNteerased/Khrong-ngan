"use client"

import { forwardRef } from "react"
import QRCode from "react-qr-code"
import { useTranslations } from "next-intl"
import { AlertTriangle, Pill } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AppLogo } from "@/components/app-logo"
import type { DrugDto } from "@/lib/api"
import { cn } from "@/lib/utils"

export type PickupTicketCardProps = {
  drug: DrugDto
  quantity: number
  ticketCode: string
  remainingSeconds: number
  expired?: boolean
  className?: string
}

export function formatTicketMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

export const PickupTicketCard = forwardRef<HTMLDivElement, PickupTicketCardProps>(
  function PickupTicketCard(
    { drug, quantity, ticketCode, remainingSeconds, expired = false, className },
    ref
  ) {
    const t = useTranslations("QRTicket")
    const lowTime = !expired && remainingSeconds > 0 && remainingSeconds <= 60
    const isExpired = expired || remainingSeconds <= 0

    const warningText = [t("warning"), drug.warnings?.trim()]
      .filter(Boolean)
      .join(" ")

    return (
      <div
        ref={ref}
        className={cn(
          "w-[400px] max-w-full overflow-hidden rounded-2xl border border-primary/20 bg-white shadow-lg",
          className
        )}
      >
        <div className="flex items-center gap-3 bg-gradient-to-r from-[#023c75] to-[#034d96] px-5 py-4 text-white">
          <div className="rounded-full bg-white/90 p-1">
            <AppLogo size={32} className="rounded-full" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider opacity-90">LaneYa</p>
            <h2 className="text-lg font-semibold leading-tight">{t("title")}</h2>
          </div>
          <Badge className="max-w-[140px] shrink truncate bg-white/20 text-white hover:bg-white/30">
            #{ticketCode}
          </Badge>
        </div>

        <div className="flex flex-col items-center gap-4 bg-white px-5 py-6">
          <div
            className={cn(
              "rounded-xl border-4 p-3",
              isExpired
                ? "border-red-300 bg-red-50"
                : "border-[#023c75]/20 bg-white"
            )}
          >
            <QRCode
              value={ticketCode}
              size={180}
              level="M"
              style={{ height: "auto", width: "180px" }}
            />
          </div>

          <div
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold tabular-nums",
              isExpired
                ? "bg-red-100 text-red-700"
                : lowTime
                  ? "bg-amber-100 text-amber-800"
                  : "bg-[#023c75]/10 text-[#023c75]"
            )}
          >
            {isExpired
              ? t("expired")
              : t("expiresIn", { time: formatTicketMMSS(remainingSeconds) })}
          </div>

          <div className="w-full space-y-3 rounded-xl bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-[#023c75]/10 p-2 text-[#023c75]">
                <Pill className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900">{drug.name}</h3>
                {drug.category ? (
                  <p className="text-xs text-slate-500">{drug.category}</p>
                ) : null}
              </div>
              <Badge variant="secondary" className="shrink-0 bg-white">
                {t("slot", { slot: drug.slotId })}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-white p-3">
                <p className="text-xs text-slate-500">{t("qtyLabel")}</p>
                <p className="text-lg font-semibold tabular-nums text-slate-900">
                  {t("qtyUnit", { count: quantity })}
                </p>
              </div>
              <div className="rounded-lg bg-white p-3">
                <p className="text-xs text-slate-500">{t("dosageLabel")}</p>
                <p className="text-sm text-slate-900">
                  {drug.dosageNotes || t("noDosage")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex w-full items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-3 py-2 text-left text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{warningText}</p>
          </div>
        </div>
      </div>
    )
  }
)
