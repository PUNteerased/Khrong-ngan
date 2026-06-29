"use client"

import { useEffect, useRef, useState } from "react"
import { getKioskCameraFrameUrl } from "@/lib/kiosk-api"
import { isKioskLanMode } from "@/lib/kiosk-connectivity"
import type { KioskMessages } from "@/lib/kiosk-i18n"

const POLL_MS = 450
const PREVIEW_TIMEOUT_MS = 8000

type Props = {
  t: KioskMessages
  active: boolean
  camPreviewUrl?: string
  camOnline?: boolean
}

export function KioskCameraViewport({
  t,
  active,
  camPreviewUrl,
  camOnline,
}: Props) {
  const [tick, setTick] = useState(0)
  const [hasFrame, setHasFrame] = useState(false)
  const [previewTimedOut, setPreviewTimedOut] = useState(false)
  const hasFrameRef = useRef(false)

  useEffect(() => {
    hasFrameRef.current = hasFrame
  }, [hasFrame])

  const lanMode = isKioskLanMode()
  const frameBase = lanMode && camPreviewUrl ? camPreviewUrl : getKioskCameraFrameUrl()
  const displaySrc =
    active && frameBase
      ? `${frameBase}${frameBase.includes("?") ? "&" : "?"}t=${tick}`
      : null

  useEffect(() => {
    if (!active) {
      setHasFrame(false)
      setPreviewTimedOut(false)
      setTick(0)
      return
    }

    setHasFrame(false)
    setPreviewTimedOut(false)
    setTick(Date.now())

    const pollId = window.setInterval(() => setTick(Date.now()), POLL_MS)
    const timeoutId = window.setTimeout(() => {
      if (!hasFrameRef.current) setPreviewTimedOut(true)
    }, PREVIEW_TIMEOUT_MS)

    return () => {
      window.clearInterval(pollId)
      window.clearTimeout(timeoutId)
    }
  }, [active, camPreviewUrl, lanMode])

  useEffect(() => {
    if (hasFrame) setPreviewTimedOut(false)
  }, [hasFrame])

  const showPlaceholder = !hasFrame

  const placeholderText =
    camOnline === false
      ? t.camOffline
      : previewTimedOut && !hasFrame
        ? t.camPreviewFailed
        : showPlaceholder
          ? t.camConnecting
          : null

  return (
    <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-[#0a1628] shadow-lg aspect-[16/10]">
      {displaySrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displaySrc}
          alt=""
          className={`block h-full w-full object-cover transition-opacity duration-150 [image-rendering:auto] ${
            hasFrame ? "opacity-100" : "opacity-0"
          }`}
          onLoad={(e) => {
            const img = e.currentTarget
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              setHasFrame(true)
            }
          }}
          onError={() => {
            /* 204 / no frame yet — next poll retries */
          }}
        />
      ) : null}
      {placeholderText ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-base text-slate-400">
          {placeholderText}
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <span className="absolute left-4 top-4 h-7 w-7 rounded-tl-md border-l-[3px] border-t-[3px] border-[#55a87a]" />
        <span className="absolute right-4 top-4 h-7 w-7 rounded-tr-md border-r-[3px] border-t-[3px] border-[#55a87a]" />
        <span className="absolute bottom-4 left-4 h-7 w-7 rounded-bl-md border-b-[3px] border-l-[3px] border-[#55a87a]" />
        <span className="absolute bottom-4 right-4 h-7 w-7 rounded-br-md border-b-[3px] border-r-[3px] border-[#55a87a]" />
        <span className="absolute left-[8%] right-[8%] top-[20%] h-0.5 animate-pulse bg-gradient-to-r from-transparent via-[#55a87a] to-transparent" />
      </div>
    </div>
  )
}
