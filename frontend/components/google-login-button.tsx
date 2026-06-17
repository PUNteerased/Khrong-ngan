"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { loginWithGoogle, ApiError } from "@/lib/api"
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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const onSuccessRef = useRef(onSuccess)
  const initializedRef = useRef(false)
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""

  useEffect(() => {
    onSuccessRef.current = onSuccess
  }, [onSuccess])

  useEffect(() => {
    // When navigating client-side, Google script may already be loaded.
    if (window.google?.accounts?.id) {
      setScriptReady(true)
    }
  }, [])

  useEffect(() => {
    if (!scriptReady || !clientId || !window.google || !containerRef.current) {
      return
    }

    const el = containerRef.current
    if (!initializedRef.current) {
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
              err instanceof ApiError ? err.message : err instanceof Error ? err.message : t("googleFail")
            toast.error(msg)
          }
        },
      })
      initializedRef.current = true
    }

    const paint = () => {
      if (!el || !window.google) return
      const widthPx = Math.min(400, Math.max(280, Math.floor(el.getBoundingClientRect().width) || 320))
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
      {clientId ? (
        <div ref={containerRef} className="w-full min-w-0" />
      ) : (
        <Button type="button" variant="outline" className="w-full" disabled>
          {t("googleUnavailable")}
        </Button>
      )}
    </div>
  )
}
