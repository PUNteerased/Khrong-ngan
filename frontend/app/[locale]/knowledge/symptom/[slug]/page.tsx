"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useLocale } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { fetchKnowledgeSymptomDetail, type SymptomDetailResponse } from "@/lib/api"

export default function SymptomDetailPage() {
  const locale = useLocale()
  const params = useParams<{ slug: string }>()
  const [slug, setSlug] = useState("")
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SymptomDetailResponse | null>(null)

  useEffect(() => {
    setSlug(String(params.slug || ""))
  }, [params])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLoading(true)
    fetchKnowledgeSymptomDetail(slug, locale)
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
  if (!data) return <div className="p-4 text-sm text-muted-foreground">ไม่พบข้อมูลอาการ</div>

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
          <Badge variant="secondary">{data.dangerLevel}</Badge>
          <p className="text-sm">{data.observationGuide}</p>
          {data.firstAid ? <p className="text-sm">การปฐมพยาบาล: {data.firstAid}</p> : null}
          {data.redFlag ? (
            <p className="text-sm text-destructive">อาการนี้มีสัญญาณ Red Flag</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="font-medium">โรคที่อาจเกี่ยวข้อง</h2>
          <div className="space-y-2">
            {data.possibleDiseases.map((d) => (
              <Link key={d.id} href={`/${locale}/knowledge/disease/${d.slug}`}>
                <div className="rounded-md border p-3 hover:bg-muted/40">
                  <div className="font-medium">{d.name}</div>
                  <div className="text-sm text-muted-foreground">{d.severityLevel}</div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="font-medium">ยาที่ช่วยบรรเทา</h2>
          <div className="space-y-2">
            {data.reliefDrugs.map((d) => (
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
