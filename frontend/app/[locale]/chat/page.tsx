"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import QRCode from "react-qr-code"
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Expand,
  ImagePlus,
  Pill,
  QrCode,
  Send,
  UserCircle2,
} from "lucide-react"
import { Link, useRouter } from "@/i18n/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AppLogo } from "@/components/app-logo"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
import { QRTicket } from "@/components/qr-ticket"
import { ChatMarkdown } from "@/components/chat-markdown"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  ApiError,
  fetchChatSessionMessages,
  fetchDrugs,
  fetchMe,
  sendChatMessage,
  type DrugDto,
  type UserProfile,
} from "@/lib/api"
import { getStoredToken } from "@/lib/auth-token"
import { uploadImage } from "@/lib/upload-image"
import { isSupabaseConfigured } from "@/lib/supabase"

interface Message {
  id: string
  content: string
  imageUrl?: string | null
  recommendedDrug?: DrugDto | null
  qrTicket?: {
    code: string
    expiresAt: string
    quantity: number
    drug: DrugDto
  } | null
  sender: "user" | "ai"
  timestamp: Date
}

function randomFive() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let out = ""
  for (let i = 0; i < 5; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

function buildTicketCode(drug: DrugDto, quantity: number) {
  const cabinetCode = "AA" // reserved for multi-cabinet in the future
  const slotRaw = (drug.slotId || "A1").toUpperCase()
  const slot = slotRaw.length >= 2 ? slotRaw.slice(0, 2) : `${slotRaw}1`.slice(0, 2)
  const qty = String(Math.max(1, quantity)).padStart(2, "0")
  const middle = `${cabinetCode}${slot}${qty}`
  return `LNY-${middle}-${randomFive()}`
}

function containsQrIntent(text: string) {
  const input = text.toLowerCase()
  return /(qr|qrcode|ticket|คิวอาร์|คิวอา|ตั๋ว|qr code)/i.test(input)
}

function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

function ChatQrCard({
  ticket,
  onOpenFull,
}: {
  ticket: NonNullable<Message["qrTicket"]>
  onOpenFull: () => void
}) {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(0, Math.floor((new Date(ticket.expiresAt).getTime() - Date.now()) / 1000))
  )
  const expired = remainingSeconds <= 0
  const qrPayload = useMemo(
    () =>
      JSON.stringify({
        code: ticket.code,
        drugId: ticket.drug.id,
        slotId: ticket.drug.slotId,
        quantity: ticket.quantity,
        expiresAt: ticket.expiresAt,
      }),
    [ticket]
  )

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemainingSeconds(
        Math.max(0, Math.floor((new Date(ticket.expiresAt).getTime() - Date.now()) / 1000))
      )
    }, 1000)
    return () => window.clearInterval(id)
  }, [ticket.expiresAt])

  return (
    <button
      type="button"
      onClick={onOpenFull}
      className="mt-3 w-full rounded-lg border border-primary/30 bg-primary/5 p-3 text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">QR Ticket</p>
          <p className="text-sm font-semibold text-foreground">{ticket.code}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-primary">
          <Expand className="h-3.5 w-3.5" />
          Fullscreen
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          <QrCode className="h-3.5 w-3.5" />
          <span>{ticket.drug.name}</span>
        </div>
        <span className={expired ? "text-destructive" : "text-primary"}>
          {expired ? "Expired" : `เหลือเวลา ${formatMMSS(remainingSeconds)}`}
        </span>
      </div>
      <div className="mt-3 flex justify-center rounded-lg bg-white p-3">
        <QRCode value={qrPayload} size={148} level="M" />
      </div>
    </button>
  )
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

function DrugRecommendationCard({ drug }: { drug: DrugDto }) {
  const t = useTranslations("Chat")
  return (
    <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-start gap-3">
        {drug.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={drug.imageUrl}
            alt={drug.name}
            className="h-14 w-14 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-md bg-primary/10">
            <Pill className="h-5 w-5 text-primary" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{t("drugCardLabel")}</p>
          <p className="truncate text-sm font-semibold text-foreground">{drug.name}</p>
          <p className="text-xs text-muted-foreground">
            {t("drugCardSlot", { slot: drug.slotId })}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <Button size="sm" asChild>
          <Link href={`/tickets?drugId=${encodeURIComponent(drug.id)}`}>
            {t("drugCardGetTicket")}
          </Link>
        </Button>
      </div>
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
  const [pendingImage, setPendingImage] = useState<{ url: string; previewUrl: string } | null>(
    null
  )
  const [isUploading, setIsUploading] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [drugById, setDrugById] = useState<Record<string, DrugDto>>({})
  const [activeFullscreenTicket, setActiveFullscreenTicket] =
    useState<NonNullable<Message["qrTicket"]> | null>(null)
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
    const imageUrl = pendingImage?.url ?? null
    if (!content.trim() && !imageUrl) return
    if (!getStoredToken()) {
      toast.error(t("loginRequired"))
      return
    }

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        content,
        imageUrl,
        sender: "user",
        timestamp: new Date(),
      },
    ])
    setInputValue("")
    if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl)
    setPendingImage(null)
    setIsTyping(true)

    try {
      const res = await sendChatMessage(content.trim(), chatSessionId, imageUrl)
      setChatSessionId(res.sessionId)
      const mentioned = res.safetyCheck?.mentionedDrugIds ?? []
      const recommendedId = mentioned.find((id) => !!drugById[id]) ?? null
      const userAskedQr = containsQrIntent(content.trim())
      let qrTicket: NonNullable<Message["qrTicket"]> | null = null
      if (userAskedQr) {
        const sourceDrug =
          (recommendedId ? drugById[recommendedId] : null) ??
          [...messages]
            .reverse()
            .find((m) => m.sender === "ai" && m.recommendedDrug)?.recommendedDrug ??
          null
        if (sourceDrug) {
          qrTicket = {
            code: buildTicketCode(sourceDrug, 1),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            quantity: 1,
            drug: sourceDrug,
          }
        }
      }
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          content: res.answer,
          recommendedDrug: recommendedId ? drugById[recommendedId] : null,
          qrTicket,
          sender: "ai",
          timestamp: new Date(),
        },
      ])
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("sendFail")
      toast.error(msg)
      if (err instanceof ApiError && err.status === 401) router.push("/login")
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
                  ) : (
                    <ChatMarkdown>{message.content}</ChatMarkdown>
                  )}
                  {message.sender === "ai" && message.recommendedDrug ? (
                    <DrugRecommendationCard drug={message.recommendedDrug} />
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

            {isTyping ? (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>
              </div>
            ) : null}

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
            {pendingImage ? (
              <div className="mb-2 flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingImage.previewUrl}
                  alt="preview"
                  className="h-14 w-14 rounded object-cover"
                />
                <p className="flex-1 text-xs text-muted-foreground">{t("imageAttached")}</p>
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
                {isUploading ? <Spinner className="h-4 w-4" /> : <ImagePlus className="h-5 w-5" />}
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

