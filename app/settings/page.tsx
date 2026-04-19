"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Sun,
  Moon,
  Globe,
  Shield,
  Cookie,
  ChevronRight,
  UserCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { getStoredToken } from "@/lib/auth-token"

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(true)
  const [language, setLanguage] = useState<"th" | "en">("th")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeToggle = (checked: boolean) => {
    setDarkMode(checked)
    if (checked) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }

  if (!mounted) {
    return (
      <div className="flex min-h-[calc(100vh-60px)] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!getStoredToken()) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-muted-foreground">
          กรุณาเข้าสู่ระบบเพื่อปรับการแสดงผลและความเป็นส่วนตัว
        </p>
        <Button asChild>
          <Link href="/login">เข้าสู่ระบบ</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-background pb-8">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <Link
          href="/profile"
          className="flex items-center justify-between p-4 rounded-xl border bg-card text-card-foreground shadow-sm hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">โปรไฟล์และข้อมูลสุขภาพ</p>
              <p className="text-sm text-muted-foreground">
                อายุ น้ำหนัก แพ้ยา โรคประจำตัว
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </Link>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sun className="h-5 w-5" />
              การแสดงผล
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {darkMode ? (
                  <Moon className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Sun className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium text-foreground">ธีม</p>
                  <p className="text-sm text-muted-foreground">
                    {darkMode ? "โหมดกลางคืน" : "โหมดสว่าง"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-1 rounded-lg bg-muted">
                <Button
                  variant={!darkMode ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => handleThemeToggle(false)}
                >
                  Light
                </Button>
                <Button
                  variant={darkMode ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => handleThemeToggle(true)}
                >
                  Dark
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">ภาษา</p>
                  <p className="text-sm text-muted-foreground">Language</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-1 rounded-lg bg-muted">
                <Button
                  variant={language === "th" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => setLanguage("th")}
                >
                  ไทย
                </Button>
                <Button
                  variant={language === "en" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => setLanguage("en")}
                >
                  Eng
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              ความเป็นส่วนตัวและคุกกี้
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/privacy"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">นโยบายความเป็นส่วนตัว</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
            <Link
              href="/cookies"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Cookie className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">จัดการคุกกี้</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
