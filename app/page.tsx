"use client"

import Link from "next/link"
import {
  Bot,
  Search,
  Pill,
  Stethoscope,
  Thermometer,
  Clock,
  QrCode,
  AlertTriangle,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { healthArticles } from "@/data/health-articles"
import { HealthTipCard } from "@/components/health-tip-card"

const HOME_HEALTH_TIPS_LIMIT = 5

const quickAccessItems = [
  {
    href: "/knowledge?tab=drug",
    label: "คลังยา",
    icon: Pill,
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    href: "/knowledge?tab=disease",
    label: "คลังโรค",
    icon: Stethoscope,
    color: "bg-green-500/10 text-green-600",
  },
  {
    href: "/knowledge?tab=symptom",
    label: "อาการ",
    icon: Thermometer,
    color: "bg-orange-500/10 text-orange-600",
  },
  {
    href: "/history",
    label: "ประวัติ",
    icon: Clock,
    color: "bg-purple-500/10 text-purple-600",
  },
]

export default function HomePage() {
  const [hasQRCode] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="flex flex-col min-h-[calc(100vh-60px)]">
      {/* Hero Section - AI Consultation */}
      <section className="bg-gradient-to-b from-primary/5 to-background px-4 py-8">
        <div className="max-w-md mx-auto text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">
              สวัสดีครับ วันนี้มีอาการอย่างไร
            </h1>
            <p className="text-muted-foreground text-sm">
              ให้ LaneYa ช่วยประเมินไหม?
            </p>
          </div>

          <Link href="/chat">
            <Button
              size="lg"
              className="w-full py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all"
            >
              <Bot className="mr-2 h-6 w-6" />
              เริ่มปรึกษาอาการกับ AI
            </Button>
          </Link>

          <p className="text-xs text-muted-foreground">
            วิเคราะห์อาการเบื้องต้นและรับ QR Code เพื่อรับยาที่ตู้
          </p>
        </div>
      </section>

      {/* QR Code Status - Conditional */}
      {hasQRCode && (
        <section className="px-4 -mt-2">
          <Card className="bg-success/10 border-success/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-success/20">
                    <QrCode className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      คุณมียาที่รอการรับที่ตู้
                    </p>
                    <p className="text-sm text-muted-foreground">
                      เหลือเวลาอีก 12:45 นาที
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  แสดง QR
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Search & Quick Access */}
      <section className="px-4 py-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาชื่อยา, อาการ หรือโรค..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-4 gap-3">
          {quickAccessItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className={`p-2.5 rounded-full ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-foreground">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Health Tips — แสดง 5 การ์ดแรกแบบเลื่อนข้าง, ที่เหลือที่ /health-tips */}
      <section className="px-4 py-4 space-y-3" aria-labelledby="home-health-tips-heading">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h2
              id="home-health-tips-heading"
              className="font-semibold text-foreground"
            >
              เกร็ดความรู้สุขภาพ
            </h2>
            <p className="text-xs text-muted-foreground">
              เลื่อนดูเกร็ดล่าสุด {HOME_HEALTH_TIPS_LIMIT} เรื่อง — เรื่องอื่นกด{" "}
              <span className="text-foreground/80">ดูทั้งหมด</span>
            </p>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0 text-primary" asChild>
            <Link href="/health-tips">
              ดูทั้งหมด
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <ul className="-mx-4 flex snap-x snap-mandatory list-none gap-3 overflow-x-auto overflow-y-hidden px-4 pb-2 scroll-smooth">
          {healthArticles.slice(0, HOME_HEALTH_TIPS_LIMIT).map((article) => (
            <li key={article.slug} className="snap-start">
              <HealthTipCard article={article} layout="carousel" />
            </li>
          ))}
        </ul>
      </section>

      {/* Footer / Emergency */}
      <section className="mt-auto px-4 py-4 space-y-3">
        <a
          href="tel:1669"
          className="flex items-center justify-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
        >
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">กรณีฉุกเฉิน โทร 1669</span>
        </a>

        <p className="text-xs text-center text-muted-foreground pb-2">
          ระบบ AI เป็นการประเมินเบื้องต้นเท่านั้น หากอาการรุนแรงโปรดพบแพทย์
        </p>
      </section>
    </div>
  )
}
