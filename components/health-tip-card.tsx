import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { HealthArticle } from "@/data/health-articles"

type HealthTipCardProps = {
  article: HealthArticle
  /** การ์ดแนวนอนเลื่อนบน Home — กำหนดความกว้างคงที่ */
  layout?: "default" | "carousel"
  className?: string
}

export function HealthTipCard({
  article,
  layout = "default",
  className,
}: HealthTipCardProps) {
  const isCarousel = layout === "carousel"

  return (
    <Link
      href={`/health-tips/${article.slug}`}
      className={cn(
        "block",
        isCarousel && "aspect-[4/3] w-[min(272px,82vw)] shrink-0",
        className
      )}
    >
      <Card
        className={cn(
          "h-full w-full overflow-hidden transition-shadow hover:shadow-md",
          isCarousel && "gap-0 py-0"
        )}
      >
        <CardContent className="flex h-full min-h-0 items-stretch gap-0 p-0">
          <div className="w-1 shrink-0 bg-primary/80" aria-hidden />
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden",
              isCarousel ? "p-3" : "p-4"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <Badge variant="secondary" className="text-xs font-normal">
                {article.category}
              </Badge>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
            <p
              className={cn(
                "font-medium leading-snug text-foreground",
                isCarousel && "line-clamp-3"
              )}
            >
              {article.title}
            </p>
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {article.excerpt}
            </p>
            <span className="mt-auto text-xs font-medium text-primary">
              อ่านเพิ่มเติม
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
