"use client"

import { useCallback, useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { HealthTipCard } from "@/components/health-tip-card"
import { fetchHealthTipsSearch, fetchWithRetry, type HealthTipListItem } from "@/lib/api"

export function HealthTipsList() {
  const locale = useLocale()
  const t = useTranslations("HealthTips")
  const [tips, setTips] = useState<HealthTipListItem[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    fetchWithRetry(() => fetchHealthTipsSearch("", locale))
      .then((rows) => {
        if (cancelled) return
        setTips(rows)
        setStatus("ready")
      })
      .catch(() => {
        if (cancelled) return
        setTips([])
        setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [locale, reloadKey])

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Spinner className="h-5 w-5" />
        <span>{t("loading")}</span>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">{t("loadError")}</p>
        <Button variant="outline" size="sm" onClick={reload}>
          {t("retry")}
        </Button>
      </div>
    )
  }

  if (tips.length === 0) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{t("empty")}</div>
  }

  return (
    <ul className="space-y-3">
      {tips.map((tip) => (
        <li key={tip.slug}>
          <HealthTipCard
            article={{
              slug: tip.slug,
              title: tip.title,
              excerpt: tip.summary,
              category: tip.category || "—",
            }}
          />
        </li>
      ))}
    </ul>
  )
}
