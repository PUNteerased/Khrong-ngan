"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import QRCode from "react-qr-code"
import { Download, Sun, Ticket } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchDrugs, type DrugDto } from "@/lib/api"

function makeTicketCode() {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `LNY-${rand}`
}

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = String(Math.floor(total / 60)).padStart(2, "0")
  const s = String(total % 60).padStart(2, "0")
  return `${m}:${s}`
}

export default function TicketsPage() {
  const tNav = useTranslations("Nav")
  const tQr = useTranslations("QRTicket")
  const searchParams = useSearchParams()
  const drugId = searchParams.get("drugId")
  const [loadingDrug, setLoadingDrug] = useState<boolean>(!!drugId)
  const [drug, setDrug] = useState<DrugDto | null>(null)
  const [ticketCode] = useState(makeTicketCode)
  const [expiresAt] = useState(() => Date.now() + 15 * 60 * 1000)
  const [remainingMs, setRemainingMs] = useState(() => expiresAt - Date.now())

  useEffect(() => {
    if (!drugId) return
    let cancelled = false
    ;(async () => {
      try {
        const all = await fetchDrugs()
        if (cancelled) return
        setDrug(all.find((d) => d.id === drugId) ?? null)
      } finally {
        if (!cancelled) setLoadingDrug(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [drugId])

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemainingMs(expiresAt - Date.now())
    }, 1000)
    return () => window.clearInterval(id)
  }, [expiresAt])

  const expired = remainingMs <= 0
  const qrPayload = useMemo(
    () =>
      JSON.stringify({
        ticketCode,
        drugId: drug?.id ?? null,
        slotId: drug?.slotId ?? null,
        expiresAt,
      }),
    [ticketCode, drug, expiresAt]
  )

  return (
    <div className="space-y-4 py-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            {tNav("tickets")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingDrug ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-[220px] w-[220px]" />
              <Skeleton className="h-4 w-52" />
            </div>
          ) : (
            <>
              <div className="rounded-lg border p-4">
                <div className="mb-3 text-sm text-muted-foreground">{ticketCode}</div>
                <div className="inline-block rounded-xl bg-white p-3">
                  <QRCode value={qrPayload} size={220} />
                </div>
                <p className="mt-3 text-sm font-medium">
                  {expired ? tQr("expired") : tQr("expiresIn", { time: formatRemaining(remainingMs) })}
                </p>
                {drug ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tQr("slot", { slot: drug.slotId })}
                  </p>
                ) : null}
              </div>

              <div className="rounded-lg border border-amber-400/40 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="mb-1 flex items-center gap-1 font-medium">
                  <Sun className="h-4 w-4" />
                  Brightness tip
                </div>
                Increase screen brightness to maximum when scanning QR at kiosk.
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => window.print()}>
                  <Download className="mr-2 h-4 w-4" />
                  {tQr("download")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

