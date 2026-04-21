"use client"

import { useLayoutEffect } from "react"

export function LocaleHtmlLang({ locale }: { locale: string }) {
  useLayoutEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  return null
}
