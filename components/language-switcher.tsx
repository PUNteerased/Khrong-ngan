"use client"

import { useLocale } from "next-intl"
import { Link, usePathname } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
export function LanguageSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()
  const nextLocale = locale === "th" ? "en" : "th"
  const label = nextLocale === "en" ? "EN" : "TH"

  return (
    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-semibold" asChild>
      <Link href={pathname} locale={nextLocale}>
        {label}
      </Link>
    </Button>
  )
}
