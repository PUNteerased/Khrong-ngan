"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Minus,
  Package,
  Pill,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Ticket,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { QRTicket } from "@/components/qr-ticket"
import { getStoredToken } from "@/lib/auth-token"
import { fetchDrugSafetyCheck } from "@/lib/api"
import type { DrugDto, DrugSafetyCheckDto } from "@/lib/api"
import { cn } from "@/lib/utils"

type Props = {
  drug: DrugDto | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TICKET_MINUTES = 15

export function DrugDetailModal({ drug, open, onOpenChange }: Props) {
  const t = useTranslations("Knowledge")
  const [quantity, setQuantity] = useState(1)
  const [ticketOpen, setTicketOpen] = useState(false)
  const [ticketStartedAt, setTicketStartedAt] = useState<Date | null>(null)
  const [safety, setSafety] = useState<DrugSafetyCheckDto | null>(null)
  const [safetyLoading, setSafetyLoading] = useState(false)
  const [overrideUnsafe, setOverrideUnsafe] = useState(false)

  const ticketCode = useMemo(() => {
    if (!drug) return ""
    return `LNY-${drug.id.slice(0, 6).toUpperCase()}`
  }, [drug])

  const ticketExpiresAt = useMemo(() => {
    const base = ticketStartedAt ?? new Date()
    return new Date(base.getTime() + TICKET_MINUTES * 60 * 1000)
  }, [ticketStartedAt])

  const maxQty = drug ? Math.max(1, Math.min(drug.quantity || 1, 10)) : 1

  const isLoggedIn = typeof window !== "undefined" && !!getStoredToken()

  useEffect(() => {
    if (!open || !drug) return
    setSafety(null)
    setOverrideUnsafe(false)
    if (!isLoggedIn) return
    let cancelled = false
    setSafetyLoading(true)
    fetchDrugSafetyCheck(drug.id)
      .then((res) => {
        if (!cancelled) setSafety(res)
      })
      .catch(() => {
        if (!cancelled) setSafety(null)
      })
      .finally(() => {
        if (!cancelled) setSafetyLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, drug, isLoggedIn])

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTicketOpen(false)
      setTicketStartedAt(null)
      setQuantity(1)
      setOverrideUnsafe(false)
    }
    onOpenChange(next)
  }

  const handleIssueTicket = () => {
    setTicketStartedAt(new Date())
    setTicketOpen(true)
  }

  if (!drug) return null

  const priceText =
    drug.priceCents != null
      ? `${(drug.priceCents / 100).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ฿`
      : null

  const ingredientList = (drug.ingredientsText || "")
    .split(/[,\n;/|]+/g)
    .map((s) => s.trim())
    .filter(Boolean)

  const isUnsafe = !!safety && !safety.isSafe
  const ticketDisabled = isUnsafe && !overrideUnsafe

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-primary" />
              {drug.name}
            </DialogTitle>
            <DialogDescription>
              {drug.category ?? t("generalDrug")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-center rounded-xl bg-muted/50 p-3">
              {drug.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={drug.imageUrl}
                  alt={drug.name}
                  className="h-48 w-full rounded-lg object-contain"
                />
              ) : (
                <div className="flex h-48 w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Pill className="h-16 w-16" />
                  <p className="text-xs">{t("noImage")}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {drug.inCabinet && drug.quantity > 0 ? (
                <Badge className="bg-success/20 text-success hover:bg-success/30">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  {t("inCabinet", { slot: drug.slotId })}
                </Badge>
              ) : (
                <Badge variant="secondary">{t("outOfStock")}</Badge>
              )}
              <Badge variant="outline">
                <Package className="mr-1 h-3 w-3" />
                {t("slotLabel", { slot: drug.slotId })}
              </Badge>
              {priceText ? (
                <Badge variant="outline">{priceText}</Badge>
              ) : null}
            </div>

            {/* --- SafetyCheck banner --- */}
            {safetyLoading ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("safetyChecking")}
              </div>
            ) : !isLoggedIn ? (
              <div className="rounded-lg border border-muted bg-muted/40 p-3 text-xs text-muted-foreground">
                {t("safetyLoginHint")}
              </div>
            ) : safety ? (
              safety.isSafe ? (
                <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4" />
                    {t("safetySafeTitle")}
                  </div>
                  <p className="mt-1 text-xs text-success/90">
                    {t("safetySafeDesc")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border-2 border-destructive bg-destructive/10 p-3 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-destructive">
                    <ShieldAlert className="h-4 w-4" />
                    {t("safetyUnsafeTitle")}
                  </div>
                  <p className="text-xs text-destructive/90">
                    {t("safetyUnsafeDesc")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {safety.matchedAllergies.map((a) => (
                      <Badge
                        key={a}
                        variant="destructive"
                        className="uppercase tracking-wide"
                      >
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              )
            ) : null}

            <section className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">
                {t("indications")}
              </h4>
              <p className="text-sm text-muted-foreground">{drug.description}</p>
            </section>

            {ingredientList.length > 0 ? (
              <section className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">
                  {t("ingredients")}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {ingredientList.map((ing) => {
                    const matched =
                      safety?.matchedAllergies?.some(
                        (a) =>
                          ing.toLowerCase().includes(a) ||
                          a.includes(ing.toLowerCase())
                      ) ?? false
                    return (
                      <Badge
                        key={ing}
                        variant={matched ? "destructive" : "outline"}
                      >
                        {ing}
                      </Badge>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {drug.dosageNotes ? (
              <section className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">
                  {t("dosage")}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {drug.dosageNotes}
                </p>
              </section>
            ) : null}

            <section className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {t("contraindications")}
              </h4>
              <p className="text-sm text-destructive/90">
                {drug.warnings || t("noWarnings")}
              </p>
            </section>

            {drug.inCabinet && drug.quantity > 0 ? (
              <section className="space-y-2 rounded-xl border bg-card p-3">
                {isUnsafe ? (
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                    <Checkbox
                      checked={overrideUnsafe}
                      onCheckedChange={(v) => setOverrideUnsafe(v === true)}
                      className="mt-0.5 border-destructive data-[state=checked]:bg-destructive"
                    />
                    <span className="leading-snug">
                      {t("safetyOverride")}
                    </span>
                  </label>
                ) : null}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t("qtyPicker")}</p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span
                      className={cn(
                        "min-w-[2ch] text-center text-base font-semibold tabular-nums"
                      )}
                    >
                      {quantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        setQuantity((q) => Math.min(maxQty, q + 1))
                      }
                      disabled={quantity >= maxQty}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleIssueTicket}
                  disabled={ticketDisabled}
                  variant={isUnsafe ? "destructive" : "default"}
                >
                  <Ticket className="mr-2 h-4 w-4" />
                  {ticketDisabled ? t("safetyBlocked") : t("issueTicket")}
                </Button>
              </section>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
        <DialogContent className="max-h-[95vh] overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-md">
          <DialogTitle className="sr-only">{t("issueTicket")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("issueTicket")}
          </DialogDescription>
          <QRTicket
            drug={drug}
            quantity={quantity}
            ticketCode={ticketCode}
            expiresAt={ticketExpiresAt}
            onClose={() => setTicketOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
