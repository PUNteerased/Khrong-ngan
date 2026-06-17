"use client"

import { useLocale } from "next-intl"
import { Link, usePathname } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
export function LanguageSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()
  const [query, setQuery] = useState("")
  const nextLocale = locale === "th" ? "en" : "th"
  const label = nextLocale === "en" ? "EN" : "TH"

  useEffect(() => {
    if (typeof window === "undefined") return
    const search = window.location.search || ""
    setQuery(search.startsWith("?") ? search.slice(1) : search)
  }, [pathname])

  const href = query ? `${pathname}?${query}` : pathname

  return (
    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-semibold" asChild>
      <Link href={href} locale={nextLocale}>
        {label}
      </Link>
    </Button>
  )
}
