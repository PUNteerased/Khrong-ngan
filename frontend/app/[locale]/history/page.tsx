"use client"

import { useEffect, useState } from "react"
import { Link, useRouter } from "@/i18n/navigation"
import { useLocale, useTranslations } from "next-intl"
import { ArrowLeft, MessageSquare, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { fetchChatSessions, ApiError } from "@/lib/api"
import type { ChatSessionListItem } from "@/lib/api"
import { getStoredToken } from "@/lib/auth-token"
import { toast } from "sonner"

export default function HistoryPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("History")
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<ChatSessionListItem[]>([])

  useEffect(() => {
    if (!getStoredToken()) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const list = await fetchChatSessions()
        if (!cancelled) setSessions(list)
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.push("/login")
          return
        }
        toast.error(e instanceof ApiError ? e.message : t("loadFail"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router, t])

  if (!getStoredToken()) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-muted-foreground">{t("needLogin")}</p>
        <Button asChild>
          <Link href="/login">{t("login")}</Link>
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-60px)] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const dateLocale = locale === "en" ? "en-GB" : "th-TH"

  return (
    <div className="min-h-[calc(100vh-60px)] bg-background pb-8">
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/chat">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">{t("title")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>

        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              {t("empty")}
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={`/history/${s.id}`}>
                  <Card className="transition-colors hover:bg-muted/50">
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base font-medium flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">
                              {new Date(s.updatedAt).toLocaleString(dateLocale, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </span>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {s.preview || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("messages", { count: s.messageCount })}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
