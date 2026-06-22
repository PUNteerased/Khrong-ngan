"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { fetchGoogleAuthConfig, loginWithGoogle, ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type GoogleCredentialResponse = { credential?: string }

type GoogleLoginButtonProps = {
  mode: "signin" | "signup"
  onSuccess: (accessToken: string) => void
  className?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string
            callback: (response: GoogleCredentialResponse) => void
          }) => void
          renderButton: (
            element: HTMLElement,
            options: Record<string, unknown>
          ) => void
        }
      }
    }
  }
}

export function GoogleLoginButton({ mode, onSuccess, className }: GoogleLoginButtonProps) {
  const t = useTranslations("Login")
  const [scriptReady, setScriptReady] = useState(false)
  const [clientId, setClientId] = useState(
    () => process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? ""
  )
  const [configLoading, setConfigLoading] = useState(!clientId)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const onSuccessRef = useRef(onSuccess)
  const initializedClientIdRef = useRef<string | null>(null)

  useEffect(() => {
    onSuccessRef.current = onSuccess
  }, [onSuccess])

  useEffect(() => {
    if (window.google?.accounts?.id) {
      setScriptReady(true)
    }
  }, [])

  useEffect(() => {
    if (clientId) {
      setConfigLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await fetchGoogleAuthConfig()
        if (cancelled) return
        if (cfg.enabled && cfg.clientId) {
          setClientId(cfg.clientId)
        }
      } catch {
        // ignore — show unavailable state below
      } finally {
        if (!cancelled) setConfigLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clientId])

  useEffect(() => {
    if (!scriptReady || !clientId || !window.google || !containerRef.current) {
      return
    }

    const el = containerRef.current
    if (initializedClientIdRef.current !== clientId) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: GoogleCredentialResponse) => {
          if (!response.credential) {
            toast.error(t("googleTokenMissing"))
            return
          }
          try {
            const { accessToken } = await loginWithGoogle(response.credential)
            onSuccessRef.current(accessToken)
          } catch (err) {
            const msg =
              err instanceof ApiError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : t("googleFail")
            toast.error(msg)
          }
        },
      })
      initializedClientIdRef.current = clientId
    }

    const paint = () => {
      if (!el || !window.google) return
      const widthPx = Math.min(
        400,
        Math.max(280, Math.floor(el.getBoundingClientRect().width) || 320)
      )
      el.innerHTML = ""
      window.google.accounts.id.renderButton(el, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: widthPx,
        text: mode === "signin" ? "signin_with" : "signup_with",
        logo_alignment: "left",
        shape: "rectangular",
      })
    }

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(paint)
    })
    return () => cancelAnimationFrame(id)
  }, [clientId, mode, scriptReady, t])

  return (
    <div className={cn("w-full", className)}>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
      />
      {configLoading ? (
        <Button type="button" variant="outline" className="w-full" disabled>
          {t("loading")}
        </Button>
      ) : clientId ? (
        <div ref={containerRef} className="w-full min-w-0 min-h-10" />
      ) : (
        <Button type="button" variant="outline" className="w-full" disabled>
          {t("googleUnavailable")}
        </Button>
      )}
    </div>
  )
}
