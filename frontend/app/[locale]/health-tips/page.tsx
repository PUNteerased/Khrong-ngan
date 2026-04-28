import { getTranslations, setRequestLocale } from "next-intl/server"
import { HealthTipCard } from "@/components/health-tip-card"
import { fetchHealthTipsSearch } from "@/lib/api"

type Props = { params: Promise<{ locale: string }> }

export const dynamic = "force-dynamic"

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
  const tips = await fetchHealthTipsSearch("")

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-10">
      <div className="mb-6 space-y-1">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ul className="space-y-3">
        {tips.map((tip) => (
          <li key={tip.slug}>
            <HealthTipCard
              article={{
                slug: tip.slug,
                title: tip.titleTh,
                excerpt: tip.summaryTh,
                category: tip.category || "—",
                imageUrl: tip.coverImageUrl || undefined,
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
