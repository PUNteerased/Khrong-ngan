"use client"

import { useEffect, useRef, useState } from "react"
import QRCode from "react-qr-code"
import { Download, Expand, QrCode } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ChatQrTicket, DrugDto } from "@/lib/api"
import { PickupTicketCard } from "@/components/pickup-ticket-card"
import {
  downloadTicketJpeg,
  ticketJpegFilename,
} from "@/lib/download-ticket-jpeg"

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
  const tChat = useTranslations("Chat")
  const tTicket = useTranslations("QRTicket")
  const exportRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
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

  const handleDownload = async () => {
    if (!exportRef.current || expired) return
    setDownloading(true)
    try {
      await downloadTicketJpeg(
        exportRef.current,
        ticketJpegFilename(ticket.code)
      )
    } catch {
      toast.error(tTicket("downloadFailed"))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="mt-3 w-full rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-primary">{tChat("qrPickupTitle")}</p>
          <p className="text-xs text-muted-foreground">{tChat("qrPickupHint")}</p>
        </div>
        {showQr ? (
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={downloading}
              onClick={() => void handleDownload()}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              {downloading ? tTicket("downloadBusy") : tTicket("download")}
            </Button>
            {onOpenFull ? (
              <Button type="button" variant="secondary" size="sm" onClick={onOpenFull}>
                <Expand className="h-3.5 w-3.5 mr-1" />
                {tChat("qrOpenFullscreen")}
              </Button>
            ) : null}
          </div>
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
            ? tChat("qrRedeemed")
            : expired
              ? tChat("qrExpired")
              : tChat("qrTimeLeft", { time: formatMMSS(remainingSeconds) })}
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

      {showQr ? (
        <div
          className="pointer-events-none fixed left-[-9999px] top-0 opacity-0"
          aria-hidden
        >
          <PickupTicketCard
            ref={exportRef}
            drug={ticket.drug}
            quantity={ticket.quantity}
            ticketCode={ticket.code}
            remainingSeconds={remainingSeconds}
          />
        </div>
      ) : null}
    </div>
  )
}
