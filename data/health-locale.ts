import type { HealthArticle } from "./health-articles"
import { healthArticles } from "./health-articles"
import { healthArticlesEn } from "./health-articles-en"

export function getHealthArticles(locale: string): HealthArticle[] {
  return locale === "en" ? healthArticlesEn : healthArticles
}

export function getLocalizedHealthArticle(
  slug: string,
  locale: string
): HealthArticle | undefined {
  return getHealthArticles(locale).find((a) => a.slug === slug)
}
