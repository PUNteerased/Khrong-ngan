"use client"

import { useState, useEffect, Suspense, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useMessages, useTranslations } from "next-intl"
import { Search, Pill, Stethoscope, Thermometer, CheckCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { fetchDrugs, type DrugDto } from "@/lib/api"

type KnowledgeDataMsg = {
  d1n: string
  d1t: string[]
  d1d: string
  d2n: string
  d2t: string[]
  d2d: string
  d3n: string
  d3t: string[]
  d3d: string
  d4n: string
  d4t: string[]
  d4d: string
  s1n: string
  s1d: string
  s2n: string
  s2d: string
  s3n: string
  s3d: string
  s4n: string
  s4d: string
  s5n: string
  s5d: string
}

function KnowledgeContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const t = useTranslations("Knowledge")
  const messages = useMessages()
  const kd = (messages as { KnowledgeData: KnowledgeDataMsg }).KnowledgeData

  const diseases = useMemo(
    () => [
      { id: 1, name: kd.d1n, tags: kd.d1t, description: kd.d1d },
      { id: 2, name: kd.d2n, tags: kd.d2t, description: kd.d2d },
      { id: 3, name: kd.d3n, tags: kd.d3t, description: kd.d3d },
      { id: 4, name: kd.d4n, tags: kd.d4t, description: kd.d4d },
    ],
    [kd]
  )

  const symptoms = useMemo(
    () => [
      { id: 1, name: kd.s1n, severity: "mild", description: kd.s1d },
      { id: 2, name: kd.s2n, severity: "mild", description: kd.s2d },
      { id: 3, name: kd.s3n, severity: "moderate", description: kd.s3d },
      { id: 4, name: kd.s4n, severity: "mild", description: kd.s4d },
      { id: 5, name: kd.s5n, severity: "mild", description: kd.s5d },
    ],
    [kd]
  )

  const [activeTab, setActiveTab] = useState(tabParam || "disease")
  const [searchQuery, setSearchQuery] = useState("")
  const [drugs, setDrugs] = useState<DrugDto[]>([])
  const [drugsLoading, setDrugsLoading] = useState(false)

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  useEffect(() => {
    let cancelled = false
    setDrugsLoading(true)
    fetchDrugs()
      .then((data) => {
        if (!cancelled) setDrugs(data)
      })
      .catch(() => {
        if (!cancelled) setDrugs([])
      })
      .finally(() => {
        if (!cancelled) setDrugsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
          <TabsList className="w-full grid grid-cols-3">
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
          {diseases
            .filter((d) =>
              d.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((disease) => (
              <Card
                key={disease.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <h3 className="font-semibold text-foreground">
                        {disease.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {disease.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {disease.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Stethoscope className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="symptom" className="p-4 space-y-3 mt-0">
          {symptoms
            .filter((s) =>
              s.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((symptom) => (
              <Card
                key={symptom.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <h3 className="font-semibold text-foreground">
                        {symptom.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {symptom.description}
                      </p>
                    </div>
                    <Thermometer className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="drug" className="p-4 space-y-3 mt-0">
          {drugsLoading ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : (
            drugs
              .filter((d) =>
                d.name.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((drug) => (
                <Card
                  key={drug.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-foreground">
                            {drug.name}
                          </h3>
                          {drug.inCabinet && drug.quantity > 0 ? (
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
                        <p className="text-sm text-muted-foreground">
                          {drug.description}
                        </p>
                        {drug.category ? (
                          <Badge variant="outline" className="text-xs">
                            {drug.category}
                          </Badge>
                        ) : null}
                      </div>
                      <Pill className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))
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
