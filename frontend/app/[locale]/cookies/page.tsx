"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Cookie, Lock, BarChart3, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export default function CookiesPage() {
  const t = useTranslations("Cookies")
  const [analyticsCookies, setAnalyticsCookies] = useState(true)

  return (
    <div className="min-h-[calc(100vh-60px)] bg-background pb-8">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Cookie className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">{t("title")}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t("settings")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Lock className="h-5 w-5 text-success" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{t("necessaryTitle")}</p>
                  <p className="text-sm text-muted-foreground">{t("necessaryDesc")}</p>
                </div>
              </div>
              <Switch checked disabled className="data-[state=checked]:bg-success" />
            </div>

            <Separator />

            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{t("analyticsTitle")}</p>
                  <p className="text-sm text-muted-foreground">{t("analyticsDesc")}</p>
                </div>
              </div>
              <Switch
                checked={analyticsCookies}
                onCheckedChange={setAnalyticsCookies}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-5 w-5" />
              {t("aboutTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{t("about1")}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("about2")}</p>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1">
            {t("rejectAll")}
          </Button>
          <Button className="flex-1">{t("acceptAll")}</Button>
        </div>
      </div>
    </div>
  )
}
