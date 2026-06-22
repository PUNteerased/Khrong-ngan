"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Download, Home } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import type { DrugDto } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  PickupTicketCard,
  formatTicketMMSS,
} from "@/components/pickup-ticket-card"
import {
  downloadTicketJpeg,
  ticketJpegFilename,
} from "@/lib/download-ticket-jpeg"
import { toast } from "sonner"

type Props = {
  drug: DrugDto
  quantity: number
  ticketCode: string
  signature?: string
  expiresAt: Date
  onClose?: () => void
  className?: string
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
  const ticketRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  const remaining = useCountdown(expiresAt, onClose)
  const expired = remaining <= 0

  const handleDownload = async () => {
    if (!ticketRef.current || expired) return
    setDownloading(true)
    try {
      await downloadTicketJpeg(ticketRef.current, ticketJpegFilename(ticketCode))
    } catch {
      toast.error(t("downloadFailed"))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className={cn("mx-auto w-full max-w-md", className)}>
      <PickupTicketCard
        ref={ticketRef}
        drug={drug}
        quantity={quantity}
        ticketCode={ticketCode}
        remainingSeconds={remaining}
        expired={expired}
        className="w-full shadow-lg"
      />

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={() => void handleDownload()}
          disabled={expired || downloading}
          className="sm:flex-1"
        >
          <Download className="mr-1 h-4 w-4" />
          {downloading ? t("downloadBusy") : t("download")}
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

export { formatTicketMMSS }
