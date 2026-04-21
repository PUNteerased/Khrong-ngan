import type { Metadata } from "next"
import { NextIntlClientProvider, hasLocale } from "next-intl"
import { getMessages, setRequestLocale, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { routing } from "@/i18n/routing"
import { AppShell } from "@/components/app-shell"
import { LocaleHtmlLang } from "@/components/locale-html-lang"

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Meta" })
  return {
    title: t("title"),
    description: t("description"),
    generator: "LaneYa",
    icons: {
      icon: [{ url: "/logoya_bg.png", type: "image/png" }],
      apple: "/logoya_bg.png",
    },
  }
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <NextIntlClientProvider messages={messages}>
      <LocaleHtmlLang locale={locale} />
      <AppShell>{children}</AppShell>
    </NextIntlClientProvider>
  )
}
