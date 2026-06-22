"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { KioskShell } from "@/components/kiosk/kiosk-shell"
import { KioskHeader } from "@/components/kiosk/kiosk-header"
import { KioskEmergencyBanner } from "@/components/kiosk/kiosk-emergency-banner"
import { KioskConnectivityBanner } from "@/components/kiosk/kiosk-connectivity-banner"
import { KioskScreensaver } from "@/components/kiosk/kiosk-screensaver"
import { KioskHomeChoice } from "@/components/kiosk/kiosk-home-choice"
import { KioskCodeScreen } from "@/components/kiosk/kiosk-code-screen"
import { KioskScanCountdown } from "@/components/kiosk/kiosk-scan-countdown"
import { KioskVerificationPanel } from "@/components/kiosk/kiosk-verification-panel"
import {
  KioskBottomBar,
  KioskStatusOverlay,
} from "@/components/kiosk/kiosk-bottom-bar"
import { useKioskSession } from "@/hooks/use-kiosk-session"
import { useKioskInactivity } from "@/hooks/use-kiosk-inactivity"
import { useTicketExpiry } from "@/hooks/use-ticket-expiry"
import {
  cancelKioskScan,
  confirmKioskPickup,
  startKioskScan,
  submitKioskCode,
  type KioskLocale,
} from "@/lib/kiosk-api"
import {
  isKioskCloudRelayMode,
  isKioskMixedContentBlocked,
  mapKioskSessionError,
} from "@/lib/kiosk-connectivity"
import { getKioskMessages } from "@/lib/kiosk-i18n"
import {
  KIOSK_HOME_IDLE_MS,
  KIOSK_SCAN_DURATION_SEC,
} from "@/lib/kiosk-constants"

type KioskUiScreen = "screensaver" | "home" | "codeEntry"

function speak(text: string, locale: KioskLocale) {
  if (typeof window === "undefined" || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = locale === "en" ? "en-US" : "th-TH"
  utter.rate = 0.95
  window.speechSynthesis.speak(utter)
}

export function KioskDisplay() {
  const [locale, setLocale] = useState<KioskLocale>("th")
  const [ttsOn, setTtsOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [codeBusy, setCodeBusy] = useState(false)
  const [mixedContent, setMixedContent] = useState(false)
  const [uiScreen, setUiScreen] = useState<KioskUiScreen>("screensaver")
  const prevPhaseRef = useRef<string>("idle")
  const { session, connected, phase, refresh } = useKioskSession()
  const t = useMemo(() => getKioskMessages(locale), [locale])
  const { expired: ticketExpired } = useTicketExpiry(session.preview?.expiresAt)

  useEffect(() => {
    if (isKioskCloudRelayMode()) {
      setMixedContent(false)
      return
    }
    setMixedContent(isKioskMixedContentBlocked())
  }, [])

  useEffect(() => {
    const prev = prevPhaseRef.current
    if ((prev === "success" || prev === "error") && phase === "idle") {
      setUiScreen("screensaver")
    }
    prevPhaseRef.current = phase
  }, [phase])

  useKioskInactivity({
    enabled: phase === "idle" && uiScreen === "home",
    timeoutMs: KIOSK_HOME_IDLE_MS,
    onTimeout: () => setUiScreen("screensaver"),
  })

  const scanBlocked = mixedContent || !connected
  const codeBlocked = mixedContent || !connected
  const scanDisabledReason = mixedContent
    ? t.mixedContentBody
    : !connected
      ? isKioskCloudRelayMode()
        ? t.kioskOfflineCloudBody
        : t.s3OfflineBody
      : undefined

  const errorMessage = mapKioskSessionError(session.error, locale)

  const uiPhase =
    phase === "preview"
      ? "verification"
      : phase === "scanning"
        ? "scanning"
        : phase === "dispensing" || phase === "success" || phase === "error"
          ? phase
          : "idle"

  useEffect(() => {
    if (!ttsOn) return
    if (uiPhase === "idle" && uiScreen === "home") speak(t.homeTitle, locale)
    if (uiPhase === "scanning") speak(t.cameraOn, locale)
    if (uiPhase === "verification" && session.preview) {
      const w = session.preview.drug.warnings || ""
      speak(`${session.preview.drug.name}. ${w}`, locale)
    }
    if (uiPhase === "success") speak(t.success, locale)
  }, [uiPhase, uiScreen, ttsOn, locale, t, session.preview])

  const handleOpenScan = useCallback(async () => {
    if (scanBlocked) return
    setBusy(true)
    try {
      await startKioskScan()
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.error
      toast.error(mapKioskSessionError(msg, locale))
    } finally {
      setBusy(false)
    }
  }, [scanBlocked, locale, t.error])

  const handleCancel = useCallback(async () => {
    setBusy(true)
    try {
      await cancelKioskScan()
      setUiScreen("home")
    } finally {
      setBusy(false)
    }
  }, [])

  const handleSubmitCode = useCallback(
    async (code: string) => {
      if (codeBlocked) return
      setCodeBusy(true)
      try {
        await submitKioskCode(code)
        await refresh()
      } catch (e) {
        const msg = e instanceof Error ? e.message : t.error
        const mapped = mapKioskSessionError(msg, locale)
        if (msg.includes("ticket expired") || msg.includes("ตั๋วหมดอายุ")) {
          toast.error(t.codeExpired)
        } else if (msg.includes("ticket not found")) {
          toast.error(t.codeNotFound)
        } else if (msg.includes("รูปแบบรหัส") || msg.includes("INVALID")) {
          toast.error(t.codeInvalid)
        } else {
          toast.error(mapped)
        }
      } finally {
        setCodeBusy(false)
      }
    },
    [codeBlocked, locale, t, refresh]
  )

  const handleConfirm = useCallback(async () => {
    if (ticketExpired) {
      toast.error(t.codeExpiredConfirmBlocked)
      return
    }
    setBusy(true)
    try {
      await confirmKioskPickup()
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.error
      toast.error(mapKioskSessionError(msg, locale))
    } finally {
      setBusy(false)
    }
  }, [ticketExpired, locale, t.error, t.codeExpiredConfirmBlocked])

  if (phase === "idle" && uiScreen === "screensaver") {
    return (
      <KioskScreensaver t={t} onWake={() => setUiScreen("home")} />
    )
  }

  const main = (() => {
    if (uiPhase === "scanning") {
      return (
        <KioskScanCountdown
          t={t}
          seconds={session.countdownSec || KIOSK_SCAN_DURATION_SEC}
          camOnline={session.camOnline}
          camPreviewUrl={session.camPreviewUrl}
        />
      )
    }
    if (uiPhase === "verification" && session.preview) {
      return <KioskVerificationPanel t={t} preview={session.preview} />
    }
    if (uiPhase === "dispensing" || uiPhase === "success" || uiPhase === "error") {
      return (
        <KioskStatusOverlay
          t={t}
          phase={uiPhase}
          errorMessage={uiPhase === "error" ? errorMessage : undefined}
        />
      )
    }
    if (uiScreen === "codeEntry") {
      return (
        <KioskCodeScreen
          t={t}
          onSubmit={handleSubmitCode}
          onBack={() => setUiScreen("home")}
          loading={codeBusy}
          disabled={codeBlocked}
          disabledReason={scanDisabledReason}
        />
      )
    }
    return (
      <KioskHomeChoice
        t={t}
        onOpenScan={handleOpenScan}
        onOpenCode={() => setUiScreen("codeEntry")}
        scanLoading={busy}
        scanDisabled={scanBlocked}
        codeDisabled={codeBlocked}
        disabledReason={scanDisabledReason}
        phase={phase}
        camOnline={session.camOnline}
      />
    )
  })()

  return (
    <KioskShell
      header={
        <KioskHeader
          locale={locale}
          t={t}
          ttsOn={ttsOn}
          onLocaleChange={setLocale}
          onTtsToggle={() => setTtsOn((v) => !v)}
        />
      }
      banner={
        <>
          <KioskConnectivityBanner
            t={t}
            mixedContent={mixedContent}
            connected={connected}
          />
          <KioskEmergencyBanner t={t} />
        </>
      }
      main={main}
      footer={
        <KioskBottomBar
          t={t}
          phase={phase}
          cancelDisabled={busy || phase === "dispensing"}
          confirmDisabled={busy || phase !== "preview" || ticketExpired}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
        />
      }
    />
  )
}
