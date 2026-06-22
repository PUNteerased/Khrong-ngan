"use client"

import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export type HealthTipCardItem = {
  slug: string
  title: string
  excerpt: string
  category: string
}

type HealthTipCardProps = {
  article: HealthTipCardItem
  layout?: "list" | "carousel"
}

export function HealthTipCard({ article, layout = "list" }: HealthTipCardProps) {
  const t = useTranslations("HealthTipCard")

  return (
    <Link
      href={`/health-tips/${article.slug}`}
      className={cn(
        "block h-full",
        layout === "carousel" && "min-w-[260px] max-w-[280px]"
      )}
    >
      <Card
        className={cn(
          "h-full transition-colors hover:bg-muted/40",
          layout === "carousel" && "border-border/80"
        )}
      >
        <CardContent className="p-4 flex flex-col gap-2 h-full">
          <p className="text-xs font-medium text-primary">{article.category}</p>
          <h3 className="font-semibold text-foreground leading-snug line-clamp-2">
            {article.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
            {article.excerpt}
          </p>
          <span className="text-xs text-primary inline-flex items-center gap-1 mt-auto">
            {t("readMore")}
            <ChevronRight className="h-3 w-3" />
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
