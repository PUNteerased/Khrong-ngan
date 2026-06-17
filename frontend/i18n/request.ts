import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import en from "../messages/en"
import th from "../messages/th"
import { routing } from "./routing"

const catalogs = { th, en } as const

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

  return {
    locale,
    messages: catalogs[locale as keyof typeof catalogs],
  }
})
