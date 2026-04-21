"use client"

import { useState, useRef, useEffect, Suspense, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  ImagePlus,
  Send,
  Stethoscope,
  UserCircle2,
} from "lucide-react"
import { Link, useRouter } from "@/i18n/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AppLogo } from "@/components/app-logo"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ChatMarkdown } from "@/components/chat-markdown"
import { cn } from "@/lib/utils"
import {
  sendChatMessage,
  fetchChatSessionMessages,
  fetchMe,
  ApiError,
  type UserProfile,
} from "@/lib/api"
import { getStoredToken } from "@/lib/auth-token"
import { uploadImage } from "@/lib/upload-image"
import { isSupabaseConfigured } from "@/lib/supabase"

interface Message {
  id: string
  content: string
  imageUrl?: string | null
  sender: "user" | "ai"
  timestamp: Date
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
  const [isTyping, setIsTyping] = useState(false)
  const [chatSessionId, setChatSessionId] = useState<string | null>(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [userCtx, setUserCtx] = useState<UserProfile | null>(null)
  const [pendingImage, setPendingImage] = useState<{
    url: string
    previewUrl: string
  } | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!getStoredToken()) return
    let cancelled = false
    ;(async () => {
      try {
        const me = await fetchMe()
        if (!cancelled) setUserCtx(me)
      } catch {
        // silent — badge just won't show
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl)
    }
  }, [pendingImage])

  useEffect(() => {
    const sid = sessionIdFromUrl
    if (!sid || !getStoredToken()) {
      setHistoryLoaded(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchChatSessionMessages(sid)
        if (cancelled) return
        setChatSessionId(data.sessionId)
        if (data.messages.length > 0) {
          setMessages(
            data.messages.map((m) => ({
              id: m.id,
              content: m.content,
              imageUrl: m.imageUrl,
              sender: m.role === "user" ? "user" : "ai",
              timestamp: new Date(m.createdAt),
            }))
          )
        }
      } catch {
        // keep default chat
      } finally {
        if (!cancelled) setHistoryLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionIdFromUrl])

  const handleSendMessage = async (content: string) => {
    const imageUrl = pendingImage?.url ?? null
    if (!content.trim() && !imageUrl) return
    if (!getStoredToken()) {
      toast.error(t("loginRequired"))
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      imageUrl,
      sender: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl)
    setPendingImage(null)
    setIsTyping(true)

    try {
      const res = await sendChatMessage(content.trim(), chatSessionId, imageUrl)
      setChatSessionId(res.sessionId)
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: res.answer,
        sender: "ai",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMessage])
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : t("sendFail")
      toast.error(msg)
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login")
      }
    } finally {
      setIsTyping(false)
    }
  }

  const handleFileSelected = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("imageInvalid"))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("imageTooLarge"))
      return
    }
    if (!isSupabaseConfigured()) {
      toast.error(t("imageNotConfigured"))
      return
    }
    if (!getStoredToken()) {
      toast.error(t("loginRequired"))
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setIsUploading(true)
    try {
      const { url } = await uploadImage(file, "chat")
      setPendingImage((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
        return { url, previewUrl }
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("imageUploadFail")
      toast.error(msg)
      URL.revokeObjectURL(previewUrl)
    } finally {
      setIsUploading(false)
    }
  }

  const clearPendingImage = () => {
    if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl)
    setPendingImage(null)
  }

  const contextSummary = useMemo(() => {
    if (!userCtx) return null
    const allergies = userCtx.noAllergies
      ? t("ctxAllergyNone")
      : userCtx.allergiesText?.trim() || t("ctxAllergyUnknown")
    return {
      age: userCtx.age != null ? String(userCtx.age) : "—",
      weight: userCtx.weight != null ? String(userCtx.weight) : "—",
      allergies,
    }
  }, [userCtx, t])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(locale === "en" ? "en-GB" : "th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (!historyLoaded) {
    return (
      <div className="flex flex-col h-[calc(100vh-60px)] items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">{t("loading")}</div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-60px)] w-full max-w-none flex-col bg-background xl:px-10">
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          {!getStoredToken() && (
            <Link
              href="/login"
              className="text-xs text-primary underline sm:hidden"
            >
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
          <ProfileAvatar
            src={userCtx?.avatarUrl}
            alt={t("userAvatarAlt")}
            size={30}
            ring
          />
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
        {contextSummary ? (
          <div className="flex items-center gap-2 overflow-x-auto rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-foreground">
            <Stethoscope className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="whitespace-nowrap">
              {t("contextBadge", {
                age: contextSummary.age,
                weight: contextSummary.weight,
                allergies: contextSummary.allergies,
              })}
            </span>
          </div>
        ) : null}
      </div>

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
              <AppLogo
                src="/logoya.png"
                size={28}
                className="mb-0.5 rounded-full shrink-0"
              />
            ) : null}
            <div
              className={cn(
                "max-w-[min(560px,92%)] rounded-2xl px-4 py-2.5",
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
              ) : (
                <ChatMarkdown>{message.content}</ChatMarkdown>
              )}
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
              <ProfileAvatar
                src={userCtx?.avatarUrl}
                alt={t("userAvatarAlt")}
                size={28}
              />
            ) : null}
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}

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

      <div className="border-t border-border bg-card p-3 sm:p-4">
        {pendingImage ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pendingImage.previewUrl}
              alt="preview"
              className="h-14 w-14 rounded object-cover"
            />
            <p className="flex-1 text-xs text-muted-foreground">
              {t("imageAttached")}
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={clearPendingImage}
              className="text-destructive hover:text-destructive"
            >
              {t("imageRemove")}
            </Button>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ""
              if (file) void handleFileSelected(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="flex-shrink-0"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            aria-label={t("attachImage")}
          >
            {isUploading ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
          </Button>
          <Input
            placeholder={t("inputPh")}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage(inputValue)
              }
            }}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={() => handleSendMessage(inputValue)}
            disabled={(!inputValue.trim() && !pendingImage) || isUploading}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
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
          <span className="text-sm text-muted-foreground">
            {t("suspenseLoading")}
          </span>
        </div>
      }
    >
      <ChatPageInner />
    </Suspense>
  )
}

export default ChatShell
