"use client"

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  fetchAdminSessionDetail,
  postAdminSessionFeedback,
  type AdminSessionDetail,
  ApiError,
} from "@/lib/api"
import { toast } from "sonner"

type Props = {
  sessionId: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onUpdated: () => void
}

export function AdminSessionSheet({
  sessionId,
  open,
  onOpenChange,
  onUpdated,
}: Props) {
  const t = useTranslations("Admin")
  const locale = useLocale()
  const [data, setData] = useState<AdminSessionDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState("")

  useEffect(() => {
    if (!open || !sessionId) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchAdminSessionDetail(sessionId)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled)
          toast.error(e instanceof ApiError ? e.message : t("loadFail"))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, sessionId, t])

  const sendFeedback = async (rating: "UP" | "DOWN") => {
    if (!sessionId) return
    try {
      await postAdminSessionFeedback(sessionId, {
        rating,
        note: note.trim() || undefined,
      })
      toast.success(t("feedbackSaved"))
      setNote("")
      const d = await fetchAdminSessionDetail(sessionId)
      setData(d)
      onUpdated()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("loadFail"))
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="relative z-10 shrink-0 space-y-1 border-b bg-background px-6 pt-6 pb-4 pr-14 text-left">
          <SheetTitle className="pr-2">{t("sessionDetailTitle")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("sessionDetailTitle")}
          </SheetDescription>
        </SheetHeader>
        {loading || !data ? (
          <div className="bg-background px-6 py-6">
            <p className="text-sm text-muted-foreground">{loading ? "…" : ""}</p>
          </div>
        ) : (
          <div className="relative z-0 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-background px-6 py-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">
                {data.pickupStatus === "NONE"
                  ? t("pickup_NONE")
                  : data.pickupStatus === "QR_ISSUED"
                    ? t("pickup_QR_ISSUED")
                    : data.pickupStatus === "PICKED"
                      ? t("pickup_PICKED")
                      : t("pickup_EXPIRED")}
              </Badge>
              <Badge
                variant={
                  data.severity === "ESCALATE_HOSPITAL" ? "destructive" : "secondary"
                }
              >
                {data.severity === "ESCALATE_HOSPITAL"
                  ? t("severity_ESCALATE")
                  : t("severity_ROUTINE")}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(data.createdAt).toLocaleString(
                locale === "en" ? "en-GB" : "th-TH"
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-foreground mb-1">
                {t("profileSnapshotNote")}
              </p>
              <pre className="text-[10px] bg-muted rounded-md p-2 max-h-32 overflow-auto whitespace-pre-wrap">
                {data.userProfileSnapshot
                  ? JSON.stringify(data.userProfileSnapshot, null, 2)
                  : "—"}
              </pre>
            </div>
            <div>
              <p className="text-xs font-medium text-foreground mb-1">
                {t("profileCurrentNote")}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.userCurrent.fullName} ({data.userCurrent.username}) —{" "}
                {data.userCurrent.age ?? "—"} / {data.userCurrent.weight ?? "—"} kg
              </p>
            </div>
            <ScrollArea className="min-h-[200px] flex-1 rounded-md border">
              <div className="p-3 space-y-3">
                {data.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`text-sm rounded-lg px-3 py-2 ${
                      m.role === "user"
                        ? "bg-primary/10 ml-4"
                        : "bg-muted mr-4"
                    }`}
                  >
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {m.role}
                    </span>
                    <p className="whitespace-pre-wrap mt-1">{m.content}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium">{t("feedbackUp")} / {t("feedbackDown")}</p>
              <Textarea
                rows={2}
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => void sendFeedback("UP")}
                >
                  {t("feedbackUp")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => void sendFeedback("DOWN")}
                >
                  {t("feedbackDown")}
                </Button>
              </div>
              {data.adminReview && (
                <p className="text-xs text-muted-foreground">
                  Saved: {data.adminReview.rating}
                  {data.adminReview.note ? ` — ${data.adminReview.note}` : ""}
                </p>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
