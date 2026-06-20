"use client"

import { useEffect, useState } from "react"
import QRCode from "react-qr-code"
import { Expand, QrCode } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ChatQrTicket, DrugDto } from "@/lib/api"

export type ChatQrTicketView = {
  code: string
  signature: string
  expiresAt: string
  quantity: number
  drug: DrugDto
  riskLevel?: string
  status?: string
}

export function riskBadgeClass(level: string) {
  switch (level) {
    case "ESCALATE":
    case "HIGH":
      return "bg-destructive/10 text-destructive border-destructive/30"
    case "MEDIUM":
      return "bg-amber-500/10 text-amber-800 border-amber-500/30"
    default:
      return "bg-success/10 text-success border-success/30"
  }
}

export function riskLevelKey(level: string) {
  switch (level) {
    case "ESCALATE":
      return "riskLevelEscalate" as const
    case "HIGH":
      return "riskLevelHigh" as const
    case "MEDIUM":
      return "riskLevelMedium" as const
    default:
      return "riskLevelLow" as const
  }
}

export function mapServerQrTicket(
  ticket: ChatQrTicket,
  drugById: Record<string, DrugDto>
): ChatQrTicketView | null {
  if (ticket.status === "CANCELLED") return null

  const drug =
    drugById[ticket.drugId] ??
    ({
      id: ticket.drugId,
      name: ticket.drugName,
      slotId: ticket.slotId,
      description: "",
      quantity: 0,
      inCabinet: true,
    } as DrugDto)

  return {
    code: ticket.code,
    signature: ticket.signature,
    expiresAt: ticket.expiresAt,
    quantity: ticket.quantity,
    drug,
    riskLevel: ticket.riskLevel,
    status: ticket.status,
  }
}

function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

export function RiskLevelBadge({ level }: { level: string }) {
  const t = useTranslations("Chat")
  return (
    <Badge variant="outline" className={cn("mt-2 text-xs", riskBadgeClass(level))}>
      {t("riskLevel", { level: t(riskLevelKey(level)) })}
    </Badge>
  )
}

export function ChatQrCard({
  ticket,
  onOpenFull,
}: {
  ticket: ChatQrTicketView
  onOpenFull?: () => void
}) {
  const t = useTranslations("Chat")
  const redeemed = ticket.status === "REDEEMED"
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(0, Math.floor((new Date(ticket.expiresAt).getTime() - Date.now()) / 1000))
  )
  const expired =
    ticket.status === "EXPIRED" ||
    (!redeemed && remainingSeconds <= 0)
  const showQr = !redeemed && !expired

  useEffect(() => {
    if (!showQr) return
    const id = window.setInterval(() => {
      setRemainingSeconds(
        Math.max(0, Math.floor((new Date(ticket.expiresAt).getTime() - Date.now()) / 1000))
      )
    }, 1000)
    return () => window.clearInterval(id)
  }, [ticket.expiresAt, showQr])

  return (
    <div className="mt-3 w-full rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-primary">{t("qrPickupTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("qrPickupHint")}</p>
        </div>
        {showQr && onOpenFull ? (
          <Button type="button" variant="secondary" size="sm" onClick={onOpenFull}>
            <Expand className="h-3.5 w-3.5 mr-1" />
            {t("qrOpenFullscreen")}
          </Button>
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          <QrCode className="h-3.5 w-3.5" />
          <span>{ticket.drug.name}</span>
          <span className="text-muted-foreground/70">({ticket.drug.slotId})</span>
        </div>
        <span
          className={
            redeemed
              ? "text-muted-foreground"
              : expired
                ? "text-destructive"
                : "text-primary"
          }
        >
          {redeemed
            ? t("qrRedeemed")
            : expired
              ? t("qrExpired")
              : t("qrTimeLeft", { time: formatMMSS(remainingSeconds) })}
        </span>
      </div>
      {showQr ? (
        <>
          <div className="mt-3 flex justify-center rounded-lg bg-white p-3">
            <QRCode value={ticket.code} size={168} level="M" />
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">{ticket.code}</p>
        </>
      ) : (
        <p className="mt-2 text-center text-xs text-muted-foreground">{ticket.code}</p>
      )}
    </div>
  )
}
