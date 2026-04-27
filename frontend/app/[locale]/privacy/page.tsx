"use client"

import { useTranslations } from "next-intl"
import { ShieldCheck, LockKeyhole, Database } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function PrivacyPage() {
  const t = useTranslations("Settings")

  return (
    <div className="min-h-[calc(100vh-60px)] bg-background pb-8">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t("privacyTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("privacyLink")}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LockKeyhole className="h-5 w-5" />
              ข้อมูลที่เราจัดเก็บ
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>เราเก็บข้อมูลบัญชี ข้อมูลสุขภาพที่คุณกรอก และประวัติการใช้งานที่จำเป็นต่อการให้บริการ</p>
            <p>ระบบจะใช้ข้อมูลเพื่อช่วยประเมินอาการเบื้องต้นและปรับคำแนะนำให้เหมาะสมกับผู้ใช้</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-5 w-5" />
              การใช้งานข้อมูล
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>ข้อมูลของคุณจะถูกใช้ภายในระบบเพื่อการให้บริการเท่านั้น</p>
            <p>คุณสามารถแก้ไขข้อมูลโปรไฟล์หรือลบบัญชีได้จากหน้าโปรไฟล์</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
