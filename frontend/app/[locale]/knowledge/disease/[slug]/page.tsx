"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useLocale } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { fetchKnowledgeDiseaseDetail, type DiseaseDetailResponse } from "@/lib/api"

export default function DiseaseDetailPage() {
  const locale = useLocale()
  const params = useParams<{ slug: string }>()
  const [slug, setSlug] = useState("")
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DiseaseDetailResponse | null>(null)

  useEffect(() => {
    setSlug(String(params.slug || ""))
  }, [params])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLoading(true)
    fetchKnowledgeDiseaseDetail(slug, locale)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug, locale])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }
  if (!data) return <div className="p-4 text-sm text-muted-foreground">ไม่พบข้อมูลโรค</div>

  return (
    <div className="p-4 space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${locale}/knowledge`} className="hover:underline">
          คลังข้อมูล
        </Link>{" "}
        / <span>{data.name}</span>
      </div>
      <Card>
        <CardContent className="p-4 space-y-2">
          <h1 className="text-xl font-semibold">{data.name}</h1>
          {data.nameEn ? <p className="text-sm text-muted-foreground">{data.nameEn}</p> : null}
          <Badge variant="secondary">{data.severityLevel}</Badge>
          <p className="text-sm">{data.definition}</p>
          {data.selfCareAdvice ? (
            <p className="text-sm">การดูแลเบื้องต้น: {data.selfCareAdvice}</p>
          ) : null}
          {data.redFlagAdvice ? (
            <p className="text-sm text-destructive">สัญญาณอันตราย: {data.redFlagAdvice}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="font-medium">อาการที่เกี่ยวข้อง</h2>
          <div className="flex flex-wrap gap-2">
            {data.relatedSymptoms.map((s) => (
              <Link key={s.id} href={`/${locale}/knowledge/symptom/${s.slug}`}>
                <Badge variant="outline">{s.name}</Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="font-medium">ยาที่แนะนำ</h2>
          <div className="space-y-2">
            {data.suggestedDrugs.map((d) => (
              <Link key={d.id} href={`/${locale}/knowledge/drug/${d.slug || d.id}`}>
                <div className="rounded-md border p-3 hover:bg-muted/40">
                  <div className="font-medium">{d.name}</div>
                  <div className="text-sm text-muted-foreground">{d.description}</div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
