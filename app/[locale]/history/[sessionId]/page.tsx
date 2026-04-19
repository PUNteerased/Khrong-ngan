"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Link, useRouter } from "@/i18n/navigation"
import { useLocale, useTranslations } from "next-intl"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ChatMarkdown } from "@/components/chat-markdown"
import { fetchChatSessionMessages, ApiError } from "@/lib/api"
import { getStoredToken } from "@/lib/auth-token"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function HistoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("HistoryDetail")
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : ""
  const [loading, setLoading] = useState(true)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [messages, setMessages] = useState<
    { id: string; role: string; content: string; createdAt: string }[]
  >([])

  useEffect(() => {
    if (!sessionId || !getStoredToken()) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchChatSessionMessages(sessionId)
        if (cancelled) return
        setCreatedAt(data.createdAt)
        setMessages(data.messages)
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.push("/login")
          return
        }
        if (e instanceof ApiError && e.status === 404) {
          toast.error(t("notFound"))
          router.push("/history")
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
  }, [sessionId, router, t])

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
            <Link href="/history">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{t("title")}</h1>
            {createdAt && (
              <p className="text-xs text-muted-foreground">
                {new Date(createdAt).toLocaleString(dateLocale)}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[min(560px,92%)] rounded-2xl px-4 py-2.5",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}
              >
                {m.role === "user" ? (
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <ChatMarkdown>{m.content}</ChatMarkdown>
                )}
                <p
                  className={cn(
                    "text-xs mt-1",
                    m.role === "user"
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  )}
                >
                  {new Date(m.createdAt).toLocaleTimeString(dateLocale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
