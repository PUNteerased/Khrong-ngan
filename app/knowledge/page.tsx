"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Search, Pill, Stethoscope, Thermometer, CheckCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { fetchDrugs, type DrugDto } from "@/lib/api"

const diseases = [
  {
    id: 1,
    name: "ไข้หวัดทั่วไป",
    tags: ["ระบบทางเดินหายใจ"],
    description: "การติดเชื้อไวรัสทางเดินหายใจส่วนบน",
  },
  {
    id: 2,
    name: "อาหารเป็นพิษ",
    tags: ["ระบบทางเดินอาหาร"],
    description: "การติดเชื้อจากอาหารหรือน้ำที่ปนเปื้อน",
  },
  {
    id: 3,
    name: "ออฟฟิศซินโดรม",
    tags: ["กล้ามเนื้อและกระดูก"],
    description: "อาการปวดจากการนั่งทำงานผิดท่า",
  },
  {
    id: 4,
    name: "ไมเกรน",
    tags: ["ระบบประสาท"],
    description: "อาการปวดศีรษะรุนแรงข้างเดียว",
  },
]

const symptoms = [
  {
    id: 1,
    name: "ปวดศีรษะ",
    severity: "mild",
    description: "อาการปวดบริเวณศีรษะ",
  },
  {
    id: 2,
    name: "ไอมีเสมหะ",
    severity: "mild",
    description: "การไอที่มีเสมหะร่วมด้วย",
  },
  {
    id: 3,
    name: "ท้องเสีย",
    severity: "moderate",
    description: "ถ่ายเหลวบ่อยกว่าปกติ",
  },
  {
    id: 4,
    name: "ผื่นคัน",
    severity: "mild",
    description: "อาการคันตามผิวหนัง",
  },
  {
    id: 5,
    name: "เจ็บคอ",
    severity: "mild",
    description: "อาการเจ็บบริเวณลำคอ",
  },
]

function KnowledgeContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
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
      {/* Search Bar */}
      <div className="sticky top-0 bg-background z-20 px-4 py-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาโรค, อาการ, หรือชื่อยา..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <div className="sticky top-[61px] bg-background z-20 px-4 pt-3 border-b border-border">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="disease" className="gap-2">
              <Stethoscope className="h-4 w-4 hidden sm:inline" />
              Disease
            </TabsTrigger>
            <TabsTrigger value="symptom" className="gap-2">
              <Thermometer className="h-4 w-4 hidden sm:inline" />
              Symptom
            </TabsTrigger>
            <TabsTrigger value="drug" className="gap-2">
              <Pill className="h-4 w-4 hidden sm:inline" />
              Drug
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Disease Tab */}
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

        {/* Symptom Tab */}
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

        {/* Drug Tab */}
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
                              มีในตู้จ่ายยา ({drug.slotId})
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              ข้อมูลยาทั่วไป
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
