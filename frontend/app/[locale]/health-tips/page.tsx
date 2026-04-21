import { getTranslations, setRequestLocale } from "next-intl/server"
import { HealthTipCard } from "@/components/health-tip-card"
import { getHealthArticles } from "@/data/health-locale"

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "HealthTips" })
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
  }
}

export default async function HealthTipsIndexPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "HealthTips" })
  const articles = getHealthArticles(locale)

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-10">
      <div className="mb-6 space-y-1">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ul className="space-y-3">
        {articles.map((article) => (
          <li key={article.slug}>
            <HealthTipCard article={article} />
          </li>
        ))}
      </ul>
    </div>
  )
}
