"use client"

import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import {
  Bot,
  Search,
  Pill,
  Stethoscope,
  Thermometer,
  Clock,
  QrCode,
  AlertTriangle,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useEffect, useMemo, useState } from "react"
import { HealthTipCard } from "@/components/health-tip-card"
import { fetchHealthTipsSearch, type HealthTipListItem } from "@/lib/api"

const HOME_HEALTH_TIPS_LIMIT = 5

export default function HomePage() {
  const t = useTranslations("Home")
  const [hasQRCode] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [articles, setArticles] = useState<HealthTipListItem[]>([])

  useEffect(() => {
    let cancelled = false
    fetchHealthTipsSearch("")
      .then((rows) => {
        if (!cancelled) setArticles(rows.slice(0, HOME_HEALTH_TIPS_LIMIT))
      })
      .catch(() => {
        if (!cancelled) setArticles([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const quickAccessItems = useMemo(
    () => [
      {
        href: "/knowledge?tab=drug",
        label: t("quickDrug"),
        icon: Pill,
        color: "bg-blue-500/10 text-blue-600",
      },
      {
        href: "/knowledge?tab=disease",
        label: t("quickDisease"),
        icon: Stethoscope,
        color: "bg-green-500/10 text-green-600",
      },
      {
        href: "/knowledge?tab=symptom",
        label: t("quickSymptom"),
        icon: Thermometer,
        color: "bg-orange-500/10 text-orange-600",
      },
      {
        href: "/history",
        label: t("quickHistory"),
        icon: Clock,
        color: "bg-purple-500/10 text-purple-600",
      },
    ],
    [t]
  )

  return (
    <div className="flex flex-col min-h-[calc(100vh-60px)]">
      <section className="bg-gradient-to-b from-primary/5 to-background px-4 py-8">
        <div className="max-w-md mx-auto text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">
              {t("heroTitle")}
            </h1>
            <p className="text-muted-foreground text-sm">{t("heroSubtitle")}</p>
          </div>

          <Link href="/chat">
            <Button
              size="lg"
              className="w-full py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all"
            >
              <Bot className="mr-2 h-6 w-6" />
              {t("ctaChat")}
            </Button>
          </Link>

          <p className="text-xs text-muted-foreground">{t("ctaHint")}</p>
        </div>
      </section>

      {hasQRCode && (
        <section className="px-4 -mt-2">
          <Card className="bg-success/10 border-success/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-success/20">
                    <QrCode className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{t("qrTitle")}</p>
                    <p className="text-sm text-muted-foreground">{t("qrTime")}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  {t("qrButton")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="px-4 py-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-4 gap-3">
          {quickAccessItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className={`p-2.5 rounded-full ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-foreground">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section
        className="px-4 py-4 space-y-3"
        aria-labelledby="home-health-tips-heading"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h2
              id="home-health-tips-heading"
              className="font-semibold text-foreground"
            >
              {t("tipsTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("tipsSubtitlePrefix")} {HOME_HEALTH_TIPS_LIMIT}{" "}
              {t("tipsSubtitleMid")}{" "}
              <span className="text-foreground/80">
                {t("tipsSubtitleHighlight")}
              </span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-primary"
            asChild
          >
            <Link href="/health-tips">
              {t("viewAll")}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <ul className="-mx-4 flex snap-x snap-mandatory list-none gap-3 overflow-x-auto overflow-y-hidden px-4 pb-2 scroll-smooth">
          {articles.map((article) => (
            <li key={article.slug} className="snap-start">
              <HealthTipCard
                article={{
                  slug: article.slug,
                  title: article.titleTh,
                  excerpt: article.summaryTh,
                  category: article.category || "—",
                }}
                layout="carousel"
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-auto px-4 py-4 space-y-3">
        <a
          href="tel:1669"
          className="flex items-center justify-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
        >
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">{t("emergency")}</span>
        </a>

        <p className="text-xs text-center text-muted-foreground pb-2">
          {t("disclaimer")}
        </p>
      </section>
    </div>
  )
}
