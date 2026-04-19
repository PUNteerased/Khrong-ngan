"use client"

import { useState } from "react"
import { Cookie, Lock, BarChart3, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export default function CookiesPage() {
  const [analyticsCookies, setAnalyticsCookies] = useState(true)

  return (
    <div className="min-h-[calc(100vh-60px)] bg-background pb-8">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Cookie className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">
              ตั้งค่าความเป็นส่วนตัวของคุกกี้
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            เราใช้คุกกี้เพื่อปรับปรุงประสบการณ์การใช้งานของคุณ
            คุณสามารถเลือกปรับแต่งการตั้งค่าได้ตามต้องการ
          </p>
        </div>

        {/* Cookie Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">การตั้งค่า</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Strictly Necessary */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Lock className="h-5 w-5 text-success" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    คุกกี้ที่จำเป็น
                  </p>
                  <p className="text-sm text-muted-foreground">
                    คุกกี้เหล่านี้จำเป็นต่อการทำงานของเว็บไซต์
                    เช่น การเข้าสู่ระบบและความปลอดภัย
                  </p>
                </div>
              </div>
              <Switch checked disabled className="data-[state=checked]:bg-success" />
            </div>

            <Separator />

            {/* Analytics */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    คุกกี้เพื่อการวิเคราะห์
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ช่วยให้เราเข้าใจการใช้งานและปรับปรุงบริการ
                    เช่น สถิติการค้นหายาที่เยอะที่สุด
                  </p>
                </div>
              </div>
              <Switch
                checked={analyticsCookies}
                onCheckedChange={setAnalyticsCookies}
              />
            </div>
          </CardContent>
        </Card>

        {/* About Cookies */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-5 w-5" />
              เกี่ยวกับคุกกี้
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              คุกกี้คือไฟล์ข้อมูลขนาดเล็กที่เก็บในอุปกรณ์ของคุณ
              เราใช้คุกกี้เพื่อจดจำการตั้งค่าของคุณ วิเคราะห์การใช้งาน
              และปรับปรุงประสบการณ์โดยรวม
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ข้อมูลสุขภาพของคุณจะถูกประมวลผลตามนโยบายความเป็นส่วนตัว
              และใช้เพื่อการประเมินอาการและจ่ายยาเบื้องต้นเท่านั้น
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1">
            ปฏิเสธทั้งหมด
          </Button>
          <Button className="flex-1">ยอมรับการตั้งค่า</Button>
        </div>
      </div>
    </div>
  )
}
