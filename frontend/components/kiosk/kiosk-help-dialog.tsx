"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, HelpCircle, Phone } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { KioskMessages } from "@/lib/kiosk-i18n"
import { ISSUE_SUB_CATEGORIES } from "@/lib/issue-categories"
import {
  submitKioskIssueReport,
  type KioskSessionPhase,
} from "@/lib/kiosk-api"

const KIOSK_SUB_LABEL_KEYS: Record<string, keyof KioskMessages> = {
  qr_not_scanning: "subKioskQr",
  camera_offline: "subKioskCamera",
  code_not_working: "subKioskCode",
  dispense_failed: "subKioskDispense",
  screen_frozen: "subKioskFrozen",
  wrong_medicine: "subKioskWrongMed",
  other: "subKioskOther",
}

type Props = {
  t: KioskMessages
  phase?: KioskSessionPhase
  camOnline?: boolean
  /** Hide the built-in floating trigger button (use external control instead). */
  hideTrigger?: boolean
  /** Controlled open state. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function KioskHelpDialog({
  t,
  phase = "idle",
  camOnline,
  hideTrigger,
  open: openProp,
  onOpenChange,
}: Props) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = onOpenChange ?? setOpenState
  const [subCategory, setSubCategory] = useState("")
  const [subOther, setSubOther] = useState("")
  const [details, setDetails] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const options = useMemo(
    () =>
      ISSUE_SUB_CATEGORIES.kiosk.map((item) => ({
        value: item.value,
        label: t[KIOSK_SUB_LABEL_KEYS[item.value] ?? "subKioskOther"],
      })),
    [t]
  )

  const handleSubmit = async () => {
    if (!subCategory) {
      toast.error(t.helpReportCategoryRequired)
      return
    }
    if (subCategory === "other" && !subOther.trim()) {
      toast.error(t.helpReportCategoryRequired)
      return
    }

    setSubmitting(true)
    try {
      await submitKioskIssueReport({
        subCategory,
        subCategoryOther: subCategory === "other" ? subOther.trim() : undefined,
        description: details.trim() || undefined,
        phase,
        camOnline,
      })
      toast.success(t.helpReportSuccess)
      setSubCategory("")
      setSubOther("")
      setDetails("")
      setOpen(false)
    } catch {
      toast.error(t.helpReportFail)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {hideTrigger ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="fixed bottom-4 right-4 z-10 gap-1.5 shadow-md safe-bottom"
          onClick={() => setOpen(true)}
        >
          <HelpCircle className="h-4 w-4" />
          {t.helpButton}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.helpTitle}</DialogTitle>
          </DialogHeader>

          <a
            href="tel:1669"
            className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 transition-colors hover:bg-destructive/15"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <span className="font-semibold text-destructive">{t.helpEmergency}</span>
            <Phone className="ml-auto h-5 w-5 text-destructive" />
          </a>

          <p className="text-sm text-muted-foreground">{t.helpLocation}</p>
          <p className="text-sm font-medium text-foreground">{t.helpScanTip}</p>

          <div className="space-y-3 border-t pt-4">
            <p className="font-semibold">{t.helpReportTitle}</p>
            <Select value={subCategory} onValueChange={setSubCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t.helpReportCategoryPh} />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {subCategory === "other" ? (
              <input
                type="text"
                value={subOther}
                onChange={(e) => setSubOther(e.target.value)}
                placeholder={t.helpReportCategoryPh}
                maxLength={120}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            ) : null}

            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={t.helpReportDetailsPh}
              rows={3}
              maxLength={500}
            />

            <Button
              type="button"
              className="w-full"
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? "…" : t.helpReportSubmit}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
