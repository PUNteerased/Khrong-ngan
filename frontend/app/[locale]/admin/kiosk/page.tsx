"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { KioskDisplay } from "@/components/kiosk/kiosk-display"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getStoredAdminToken } from "@/lib/admin-token"

export default function AdminKioskPage() {
  const t = useTranslations("Admin")
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    setAuthed(Boolean(getStoredAdminToken()))
    setReady(true)
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("submitting")}</p>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("kioskAuthRequired")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("kioskAuthHint")}</p>
            <Button asChild className="w-full">
              <Link href="/admin">{t("backToAdmin")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <KioskDisplay backHref="/admin" backLabel={t("backToAdmin")} />
  )
}
