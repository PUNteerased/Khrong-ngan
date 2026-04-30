"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { fetchKnowledgeDrugDetail, type DrugDetailResponse } from "@/lib/api"

export default function KnowledgeDrugDetailPage() {
  const t = useTranslations("Knowledge")
  const locale = useLocale()
  const params = useParams<{ idOrSlug: string }>()
  const [key, setKey] = useState("")
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DrugDetailResponse | null>(null)

  useEffect(() => {
    setKey(String(params.idOrSlug || ""))
  }, [params])

  useEffect(() => {
    if (!key) return
    let cancelled = false
    setLoading(true)
    fetchKnowledgeDrugDetail(key, locale)
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
  }, [key, locale])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }
  if (!data) return <div className="p-4 text-sm text-muted-foreground">ไม่พบข้อมูลยา</div>

  return (
    <div className="p-4 space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${locale}/knowledge`} className="hover:underline">
          คลังข้อมูล
        </Link>{" "}
        / <span>{data.name}</span>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h1 className="text-xl font-semibold">{data.name}</h1>
          {data.genericName ? <p className="text-sm">ชื่อสามัญ: {data.genericName}</p> : null}
          {data.brandName ? <p className="text-sm">ยี่ห้อ: {data.brandName}</p> : null}
          <p className="text-sm">{data.description}</p>
          {data.indication ? <p className="text-sm">สรรพคุณ: {data.indication}</p> : null}
          {data.doseByAgeWeight ? (
            <p className="text-sm">วิธีใช้: {data.doseByAgeWeight}</p>
          ) : null}
          {data.contraindications ? (
            <p className="text-sm text-destructive">ข้อควรระวัง: {data.contraindications}</p>
          ) : null}
          <Badge variant={data.inCabinet ? "default" : "secondary"}>
            {data.inCabinet ? t("inCabinetShort") : t("outOfStock")}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="font-medium">ใช้รักษาโรค</h2>
          <div className="flex flex-wrap gap-2">
            {data.treatsDiseases.map((d) => (
              <Link key={d.id} href={`/${locale}/knowledge/disease/${d.slug}`}>
                <Badge variant="outline">{d.name}</Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="font-medium">ช่วยบรรเทาอาการ</h2>
          <div className="flex flex-wrap gap-2">
            {data.relievesSymptoms.map((s) => (
              <Link key={s.id} href={`/${locale}/knowledge/symptom/${s.slug}`}>
                <Badge variant="outline">{s.name}</Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
