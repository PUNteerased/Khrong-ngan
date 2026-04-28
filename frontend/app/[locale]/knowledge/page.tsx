"use client"

import Link from "next/link"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Search, Pill, Stethoscope, Thermometer, CheckCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { fetchKnowledgeSearch, type KnowledgeSearchResponse } from "@/lib/api"

function KnowledgeContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const t = useTranslations("Knowledge")
  const locale = useLocale()

  const [activeTab, setActiveTab] = useState(tabParam || "disease")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<KnowledgeSearchResponse>({
    diseases: [],
    symptoms: [],
    drugs: [],
  })

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchKnowledgeSearch(searchQuery)
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch(() => {
        if (!cancelled) setData({ diseases: [], symptoms: [], drugs: [] })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [searchQuery])

  return (
    <div className="flex flex-col min-h-[calc(100vh-60px)]">
      <div className="sticky top-0 bg-background z-20 px-4 py-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPh")}
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <div className="sticky top-[61px] bg-background z-20 px-4 pt-3 border-b border-border">
          <TabsList className="w-full grid grid-cols-3 gap-2">
            <TabsTrigger value="disease" className="gap-2">
              <Stethoscope className="h-4 w-4 hidden sm:inline" />
              {t("tabDisease")}
            </TabsTrigger>
            <TabsTrigger value="symptom" className="gap-2">
              <Thermometer className="h-4 w-4 hidden sm:inline" />
              {t("tabSymptom")}
            </TabsTrigger>
            <TabsTrigger value="drug" className="gap-2">
              <Pill className="h-4 w-4 hidden sm:inline" />
              {t("tabDrug")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="disease" className="p-4 space-y-3 mt-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : (
            data.diseases.map((disease) => {
              return (
                <Link
                  key={disease.id}
                  href={`/${locale}/knowledge/disease/${disease.slug}`}
                >
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <h3 className="font-semibold text-foreground">
                            {disease.nameTh}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {disease.definition}
                          </p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <Badge variant="secondary" className="text-xs">
                              {disease.severityLevel}
                            </Badge>
                          </div>
                        </div>
                        <Stethoscope className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })
          )}
        </TabsContent>

        <TabsContent value="symptom" className="p-4 space-y-3 mt-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : (
            data.symptoms.map((symptom) => {
              return (
                <Link
                  key={symptom.id}
                  href={`/${locale}/knowledge/symptom/${symptom.slug}`}
                >
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <h3 className="font-semibold text-foreground">
                            {symptom.nameTh}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {symptom.observationGuide}
                          </p>
                          <Badge variant="secondary" className="text-xs">
                            {symptom.dangerLevel}
                          </Badge>
                        </div>
                        <Thermometer className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })
          )}
        </TabsContent>

        <TabsContent value="drug" className="p-4 space-y-3 mt-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : (
            data.drugs.map((drug) => {
              return (
                <Link
                  key={drug.id}
                  href={`/${locale}/knowledge/drug/${drug.slug || drug.id}`}
                >
                  <Card className="cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        {drug.imageUrl ? (
                          <img
                            src={drug.imageUrl}
                            alt={drug.name}
                            className="h-16 w-16 flex-shrink-0 rounded-lg border bg-muted object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border bg-muted">
                            <Pill className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-foreground">
                              {drug.name}
                            </h3>
                            {drug.inCabinet ? (
                              <Badge className="bg-success/20 text-success hover:bg-success/30 text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {t("inCabinet", { slot: drug.slotId })}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                {t("generalDrug")}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {drug.description}
                          </p>
                          {drug.category ? (
                            <Badge variant="outline" className="text-xs">
                              {drug.category}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function KnowledgePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <KnowledgeContent />
    </Suspense>
  )
}
