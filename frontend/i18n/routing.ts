import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  locales: ["th", "en"],
  defaultLocale: "th",
  localePrefix: "as-needed",
  // Rely on URL only: unprefixed paths = Thai; `/en/...` = English (no Accept-Language/cookie override).
  localeDetection: false,
})
