import type { Request } from "express"

export type AppLang = "th" | "en"

export function parseLangQuery(req: Request): AppLang {
  const raw = String(req.query.lang ?? "").trim().toLowerCase()
  return raw === "en" ? "en" : "th"
}

/** When lang is EN, use English if non-empty; otherwise Thai. */
export function pickLang(lang: AppLang, th: string, en: string | null | undefined): string {
  const t = String(th ?? "").trim()
  const e = String(en ?? "").trim()
  if (lang === "en") return e || t
  return t
}
