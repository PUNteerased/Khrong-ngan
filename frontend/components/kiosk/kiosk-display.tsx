"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { KioskShell } from "@/components/kiosk/kiosk-shell"
import { KioskHeader } from "@/components/kiosk/kiosk-header"
import { KioskEmergencyBanner } from "@/components/kiosk/kiosk-emergency-banner"
import { KioskConnectivityBanner } from "@/components/kiosk/kiosk-connectivity-banner"
import { KioskScanPanel } from "@/components/kiosk/kiosk-scan-panel"
import { KioskScanCountdown } from "@/components/kiosk/kiosk-scan-countdown"
import { KioskVerificationPanel } from "@/components/kiosk/kiosk-verification-panel"
import {
  KioskBottomBar,
  KioskStatusOverlay,
} from "@/components/kiosk/kiosk-bottom-bar"
import { useKioskSession } from "@/hooks/use-kiosk-session"
import {
  cancelKioskScan,
  confirmKioskPickup,
  startKioskScan,
  type KioskLocale,
} from "@/lib/kiosk-api"
import {
  isKioskCloudRelayMode,
  isKioskMixedContentBlocked,
  mapKioskSessionError,
} from "@/lib/kiosk-connectivity"
import { getKioskMessages } from "@/lib/kiosk-i18n"

function speak(text: string, locale: KioskLocale) {
  if (typeof window === "undefined" || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = locale === "en" ? "en-US" : "th-TH"
  utter.rate = 0.95
  window.speechSynthesis.speak(utter)
}

type Props = {
  backHref?: string
  backLabel?: string
}

export function KioskDisplay({ backHref, backLabel }: Props) {
  const [locale, setLocale] = useState<KioskLocale>("th")
  const [ttsOn, setTtsOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mixedContent, setMixedContent] = useState(false)
  const { session, connected, phase } = useKioskSession(500)
  const t = useMemo(() => getKioskMessages(locale), [locale])

  useEffect(() => {
    if (isKioskCloudRelayMode()) {
      setMixedContent(false)
      return
    }
    setMixedContent(isKioskMixedContentBlocked())
  }, [])

  const scanBlocked = mixedContent || !connected
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
    if (uiPhase === "idle") speak(t.scanCaption, locale)
    if (uiPhase === "scanning") speak(t.cameraOn, locale)
    if (uiPhase === "verification" && session.preview) {
      const w = session.preview.drug.warnings || ""
      speak(`${session.preview.drug.name}. ${w}`, locale)
    }
    if (uiPhase === "success") speak(t.success, locale)
  }, [uiPhase, ttsOn, locale, t, session.preview])

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
    } finally {
      setBusy(false)
    }
  }, [])

  const handleConfirm = useCallback(async () => {
    setBusy(true)
    try {
      await confirmKioskPickup()
    } finally {
      setBusy(false)
    }
  }, [])

  const main = (() => {
    if (uiPhase === "scanning") {
      return (
        <KioskScanCountdown
          t={t}
          seconds={session.countdownSec || 45}
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
    return (
      <KioskScanPanel
        t={t}
        onOpenScan={handleOpenScan}
        loading={busy}
        disabled={scanBlocked}
        disabledReason={scanDisabledReason}
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
          backHref={backHref}
          backLabel={backLabel}
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
          confirmDisabled={busy || phase !== "preview"}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
        />
      }
    />
  )
}
