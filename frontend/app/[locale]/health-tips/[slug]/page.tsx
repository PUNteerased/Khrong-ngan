import { Link } from "@/i18n/navigation"
import { notFound } from "next/navigation"
import { ArrowLeft, BookMarked, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ChatMarkdown } from "@/components/chat-markdown"
import { fetchHealthTipDetail } from "@/lib/api"
import { getTranslations, setRequestLocale } from "next-intl/server"

type Props = { params: Promise<{ locale: string; slug: string }> }

export const dynamic = "force-dynamic"

function normalizeMarkdownText(text: string): string {
  return String(text || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params
  const t = await getTranslations({ locale, namespace: "HealthArticle" })
  const tip = await fetchHealthTipDetail(slug, locale).catch(() => null)
  if (!tip) return { title: t("notFoundTitle") }
  const title = tip.title
  const summary = tip.summary
  return {
    title: `${title} | LaneYa`,
    description: summary,
  }
}

export default async function HealthArticlePage({ params }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "HealthArticle" })
  const tip = await fetchHealthTipDetail(slug, locale).catch(() => null)
  if (!tip) notFound()
  const summary = normalizeMarkdownText(tip.summary)
  const content = normalizeMarkdownText(tip.contentMd)

  return (
    <div className="mx-auto max-w-lg px-4 py-4 pb-12">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2 h-9 px-2" asChild>
        <Link href="/health-tips">
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("back")}
        </Link>
      </Button>

      <article className="space-y-6">
        <header className="space-y-3">
          <Badge variant="secondary">{tip.category || "—"}</Badge>
          <h1 className="text-xl font-semibold leading-snug text-foreground">
            {tip.title}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {summary}
          </p>
        </header>

        {content ? (
          <ChatMarkdown className="text-foreground">{content}</ChatMarkdown>
        ) : null}

        {summary ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="space-y-2 p-4">
              <p className="text-sm font-medium text-foreground">
                {t("summaryShort")}
              </p>
              <p className="text-sm text-muted-foreground">{summary}</p>
            </CardContent>
          </Card>
        ) : null}

        <section className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BookMarked className="h-4 w-4 text-primary" />
            {t("referencesTitle")}
          </div>
          <ol className="space-y-3 text-sm">
            {tip.references.map((ref, index) => (
              <li key={index} className="flex gap-2">
                <span className="font-medium text-muted-foreground">
                  [{index + 1}]
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-medium text-foreground">{ref.title}</p>
                  {ref.publisher ? (
                    <p className="text-muted-foreground">{ref.publisher}</p>
                  ) : null}
                  {ref.url ? (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {t("openReference")}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <p className="rounded-lg border border-dashed border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground">
          {t("disclaimer")}
        </p>
      </article>
    </div>
  )
}
