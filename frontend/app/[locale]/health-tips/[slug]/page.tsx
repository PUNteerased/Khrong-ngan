import { Link } from "@/i18n/navigation"
import { notFound } from "next/navigation"
import { ArrowLeft, BookMarked, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getLocalizedHealthArticle } from "@/data/health-locale"
import { healthArticles } from "@/data/health-articles"
import { getTranslations, setRequestLocale } from "next-intl/server"

type Props = { params: Promise<{ locale: string; slug: string }> }

export function generateStaticParams() {
  return healthArticles.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params
  const t = await getTranslations({ locale, namespace: "HealthArticle" })
  const article = getLocalizedHealthArticle(slug, locale)
  if (!article) return { title: t("notFoundTitle") }
  return {
    title: `${article.title} | LaneYa`,
    description: article.excerpt,
  }
}

export default async function HealthArticlePage({ params }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "HealthArticle" })
  const article = getLocalizedHealthArticle(slug, locale)
  if (!article) notFound()

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
          <Badge variant="secondary">{article.category}</Badge>
          <h1 className="text-xl font-semibold leading-snug text-foreground">
            {article.title}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {article.excerpt}
          </p>
        </header>

        <div className="space-y-4 text-sm leading-relaxed text-foreground">
          {article.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {article.highlights && article.highlights.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="space-y-2 p-4">
              <p className="text-sm font-medium text-foreground">
                {t("summaryShort")}
              </p>
              <ul className="list-inside list-disc space-y-1.5 text-sm text-muted-foreground">
                {article.highlights.map((item, i) => (
                  <li key={i} className="marker:text-primary">
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <section className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BookMarked className="h-4 w-4 text-primary" />
            {t("referencesTitle")}
          </div>
          <ol className="space-y-3 text-sm">
            {article.references.map((ref, index) => (
              <li key={index} className="flex gap-2">
                <span className="font-medium text-muted-foreground">
                  [{index + 1}]
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-medium text-foreground">{ref.title}</p>
                  <p className="text-muted-foreground">{ref.source}</p>
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
