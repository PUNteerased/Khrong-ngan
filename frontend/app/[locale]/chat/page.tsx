"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Send,
  UserCircle2,
} from "lucide-react"
import { Link, useRouter } from "@/i18n/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AppLogo } from "@/components/app-logo"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { QRTicket } from "@/components/qr-ticket"
import { ChatMarkdown } from "@/components/chat-markdown"
import {
  ChatQrCard,
  mapServerQrTicket,
  type ChatQrTicketView,
} from "@/components/chat-qr-card"
import { useIsMobile } from "@/hooks/use-mobile"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  ApiError,
  fetchChatSessionMessages,
  fetchDrugs,
  fetchMe,
  sendChatMessageStream,
  type DrugDto,
  type UserProfile,
} from "@/lib/api"
import { getStoredToken } from "@/lib/auth-token"

interface Message {
  id: string
  content: string
  imageUrl?: string | null
  qrTicket?: ChatQrTicketView | null
  riskLevel?: string
  sender: "user" | "ai"
  timestamp: Date
  isStreaming?: boolean
}

function ProfileAvatar({
  src,
  alt,
  size = 30,
  ring = false,
}: {
  src?: string | null
  alt: string
  size?: number
  ring?: boolean
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-full bg-muted/70 text-muted-foreground",
        ring ? "ring-1 ring-primary/20" : ""
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <UserCircle2 className="h-[75%] w-[75%]" />
        </div>
      )}
    </div>
  )
}

function ChatPageInner() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("Chat")
  const searchParams = useSearchParams()
  const sessionIdFromUrl = searchParams.get("sessionId")

  const quickReplies = useMemo(
    () => [t("quick1"), t("quick2"), t("quick3"), t("quick4"), t("quick5"), t("quick6")],
    [t]
  )

  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [chatSessionId, setChatSessionId] = useState<string | null>(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [userCtx, setUserCtx] = useState<UserProfile | null>(null)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [drugById, setDrugById] = useState<Record<string, DrugDto>>({})
  const [activeFullscreenTicket, setActiveFullscreenTicket] =
    useState<ChatQrTicketView | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (sessionIdFromUrl) return
    setMessages([
      {
        id: "1",
        content: t("greeting"),
        sender: "ai",
        timestamp: new Date(),
      },
    ])
  }, [locale, t, sessionIdFromUrl])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (!getStoredToken()) return
    let cancelled = false
    ;(async () => {
      try {
        const me = await fetchMe()
        if (!cancelled) setUserCtx(me)
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await fetchDrugs()
        if (cancelled) return
        const map: Record<string, DrugDto> = {}
        for (const d of list) map[d.id] = d
        setDrugById(map)
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const sid = sessionIdFromUrl
    if (!sid || !getStoredToken()) {
      setHistoryLoaded(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const [data, drugs] = await Promise.all([
          fetchChatSessionMessages(sid),
          fetchDrugs(),
        ])
        if (cancelled) return
        const map: Record<string, DrugDto> = {}
        for (const d of drugs) map[d.id] = d
        setDrugById((prev) => ({ ...prev, ...map }))
        setChatSessionId(data.sessionId)
        if (data.messages.length > 0) {
          setMessages(
            data.messages.map((m) => ({
              id: m.id,
              content: m.content,
              imageUrl: m.imageUrl,
              qrTicket: m.qrTicket ? mapServerQrTicket(m.qrTicket, map) : null,
              riskLevel: m.riskLevel ?? m.qrTicket?.riskLevel ?? undefined,
              sender: m.role === "user" ? "user" : "ai",
              timestamp: new Date(m.createdAt),
            }))
          )
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setHistoryLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionIdFromUrl])

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return
    const vv = window.visualViewport
    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardInset(inset)
    }
    updateInset()
    vv.addEventListener("resize", updateInset)
    vv.addEventListener("scroll", updateInset)
    return () => {
      vv.removeEventListener("resize", updateInset)
      vv.removeEventListener("scroll", updateInset)
    }
  }, [])

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return
    if (!getStoredToken()) {
      toast.error(t("loginRequired"))
      return
    }

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        content,
        sender: "user",
        timestamp: new Date(),
      },
    ])
    setInputValue("")
    const aiMessageId = String(Date.now() + 1)
    setMessages((prev) => [
      ...prev,
      {
        id: aiMessageId,
        content: "",
        sender: "ai",
        timestamp: new Date(),
        isStreaming: true,
      },
    ])

    try {
      await sendChatMessageStream(content.trim(), chatSessionId, null, {
        onDelta: (text) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMessageId ? { ...m, content: m.content + text } : m
            )
          )
        },
        onReplace: (text) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMessageId ? { ...m, content: text } : m))
          )
        },
        onDone: (res) => {
          setChatSessionId(res.sessionId)
          const qrTicket = res.qrTicket
            ? mapServerQrTicket(res.qrTicket, drugById)
            : null
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMessageId
                ? {
                    ...m,
                    content: res.answer,
                    qrTicket,
                    riskLevel: res.riskLevel,
                    isStreaming: false,
                  }
                : m
            )
          )
        },
      })
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== aiMessageId))
      const msg = err instanceof ApiError ? err.message : t("sendFail")
      toast.error(msg)
      if (err instanceof ApiError && err.status === 401) router.push("/login")
    }
  }

  const formatTime = (date: Date) =>
    date.toLocaleTimeString(locale === "en" ? "en-GB" : "th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    })

  if (!historyLoaded) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-24 w-3/4" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-60px)] w-full max-w-none flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          {!getStoredToken() && (
            <Link href="/login" className="text-xs text-primary underline sm:hidden">
              {t("loginLink")}
            </Link>
          )}
          <div className="flex min-w-0 items-center gap-2">
            <div className="rounded-full bg-primary/10 p-0.5 ring-1 ring-primary/15">
              <AppLogo src="/logoya.png" size={32} className="rounded-full" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-semibold text-foreground">{t("title")}</h1>
              <p className="text-xs text-success">{t("online")}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ProfileAvatar src={userCtx?.avatarUrl} alt={t("userAvatarAlt")} size={30} ring />
          <Link href="/history" title={t("historyTitle")}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Clock className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="sticky top-0 z-10 space-y-2 border-b border-amber-500/20 bg-background/95 px-3 pb-2 pt-3 backdrop-blur sm:px-4">
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="leading-snug">{t("disclaimer")}</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex items-end gap-2",
                  message.sender === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.sender === "ai" ? (
                  <AppLogo src="/logoya.png" size={28} className="mb-0.5 rounded-full shrink-0" />
                ) : null}
                <div
                  className={cn(
                    "max-w-[min(620px,92%)] rounded-2xl px-4 py-2.5",
                    message.sender === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}
                >
                  {message.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={message.imageUrl}
                      alt="attached"
                      className="mb-2 max-h-60 w-full rounded-lg object-cover"
                    />
                  ) : null}
                  {message.sender === "user" ? (
                    message.content ? (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    ) : null
                  ) : message.isStreaming && !message.content ? (
                    <div className="flex gap-1.5 py-1">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0.1s]" />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                    </div>
                  ) : message.content || message.isStreaming ? (
                    <>
                      {message.content ? (
                        <ChatMarkdown>{message.content}</ChatMarkdown>
                      ) : null}
                      {message.isStreaming && message.content ? (
                        <span className="inline-block w-2 h-4 ml-0.5 bg-primary/60 animate-pulse align-middle" />
                      ) : null}
                    </>
                  ) : null}
                  {message.sender === "ai" && message.qrTicket ? (
                    <ChatQrCard
                      ticket={message.qrTicket}
                      onOpenFull={() => setActiveFullscreenTicket(message.qrTicket ?? null)}
                    />
                  ) : null}
                  <p
                    className={cn(
                      "text-xs mt-1",
                      message.sender === "user"
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {formatTime(message.timestamp)}
                  </p>
                </div>
                {message.sender === "user" ? (
                  <ProfileAvatar src={userCtx?.avatarUrl} alt={t("userAvatarAlt")} size={28} />
                ) : null}
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          <div className="px-3 pb-2 sm:px-4">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {quickReplies.map((reply) => (
                <Button
                  key={reply}
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 rounded-full"
                  onClick={() => handleSendMessage(reply)}
                >
                  {reply}
                </Button>
              ))}
            </div>
          </div>

          <div
            className="border-t border-border bg-card p-3 sm:p-4"
            style={{
              paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${keyboardInset}px + 0.5rem)`,
            }}
          >
            <div className="flex items-end gap-2">
              <Textarea
                placeholder={t("inputPh")}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isMobile) {
                    e.preventDefault()
                    void handleSendMessage(inputValue)
                  }
                }}
                rows={1}
                enterKeyHint={isMobile ? "enter" : "send"}
                className="flex-1 max-h-40 min-h-[2.5rem] resize-none py-2"
              />
              <Button
                size="icon"
                onClick={() => handleSendMessage(inputValue)}
                disabled={!inputValue.trim()}
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
      </div>
      <Dialog
        open={!!activeFullscreenTicket}
        onOpenChange={(open) => {
          if (!open) setActiveFullscreenTicket(null)
        }}
      >
        <DialogContent className="h-dvh w-screen max-w-none border-0 bg-background p-3 sm:p-6">
          <DialogTitle className="sr-only">QR Ticket Fullscreen</DialogTitle>
          <DialogDescription className="sr-only">
            Fullscreen QR for kiosk dispensing
          </DialogDescription>
          {activeFullscreenTicket ? (
            <div className="flex h-full items-center justify-center">
              <QRTicket
                drug={activeFullscreenTicket.drug}
                quantity={activeFullscreenTicket.quantity}
                ticketCode={activeFullscreenTicket.code}
                signature={activeFullscreenTicket.signature}
                expiresAt={new Date(activeFullscreenTicket.expiresAt)}
                onClose={() => setActiveFullscreenTicket(null)}
                className="max-w-xl"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ChatShell() {
  const locale = useLocale()
  const t = useTranslations("Chat")
  return (
    <Suspense
      key={locale}
      fallback={
        <div className="flex h-[calc(100vh-60px)] items-center justify-center bg-background">
          <span className="text-sm text-muted-foreground">{t("suspenseLoading")}</span>
        </div>
      }
    >
      <ChatPageInner />
    </Suspense>
  )
}

export default ChatShell
