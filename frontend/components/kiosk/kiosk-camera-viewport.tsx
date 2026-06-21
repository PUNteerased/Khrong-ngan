"use client"

import { useEffect, useRef, useState } from "react"
import { getKioskCameraFrameUrl } from "@/lib/kiosk-api"
import { isKioskLanMode } from "@/lib/kiosk-connectivity"
import type { KioskMessages } from "@/lib/kiosk-i18n"

const POLL_MS = 350

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
  const [lanTick, setLanTick] = useState(0)
  const [cloudBlobUrl, setCloudBlobUrl] = useState<string | null>(null)
  const [hasFrame, setHasFrame] = useState(false)
  const [lanLoadFailed, setLanLoadFailed] = useState(false)
  const blobRef = useRef<string | null>(null)
  const pollInFlightRef = useRef(false)

  const lanSrc =
    active && isKioskLanMode() && camPreviewUrl
      ? `${camPreviewUrl}${camPreviewUrl.includes("?") ? "&" : "?"}t=${lanTick}`
      : null

  useEffect(() => {
    if (!active || !isKioskLanMode() || !camPreviewUrl) return
    const id = window.setInterval(() => setLanTick(Date.now()), POLL_MS)
    return () => window.clearInterval(id)
  }, [active, camPreviewUrl])

  useEffect(() => {
    if (!active || isKioskLanMode()) {
      setHasFrame(false)
      return
    }

    let cancelled = false

    const commitBlobUrl = (next: string) => {
      const prev = blobRef.current
      blobRef.current = next
      setCloudBlobUrl(next)
      setHasFrame(true)
      if (prev && prev !== next) URL.revokeObjectURL(prev)
    }

    const pollCloudFrame = async () => {
      if (pollInFlightRef.current) return
      pollInFlightRef.current = true
      try {
        const res = await fetch(
          `${getKioskCameraFrameUrl()}?t=${Date.now()}`,
          { cache: "no-store" }
        )
        if (cancelled) return
        if (res.status === 204 || res.status === 404) return
        if (res.status === 429) return
        if (!res.ok) return

        const blob = await res.blob()
        if (cancelled || !blob.size) return

        const next = URL.createObjectURL(blob)
        const img = new Image()
        img.onload = () => {
          if (cancelled) {
            URL.revokeObjectURL(next)
            return
          }
          commitBlobUrl(next)
        }
        img.onerror = () => URL.revokeObjectURL(next)
        img.src = next
      } catch {
        /* retry on next poll */
      } finally {
        pollInFlightRef.current = false
      }
    }

    void pollCloudFrame()
    const id = window.setInterval(() => void pollCloudFrame(), POLL_MS)
    return () => {
      cancelled = true
      pollInFlightRef.current = false
      window.clearInterval(id)
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current)
        blobRef.current = null
      }
      setCloudBlobUrl(null)
      setHasFrame(false)
    }
  }, [active])

  const displaySrc = lanSrc ?? cloudBlobUrl
  const showPlaceholder =
    !displaySrc ||
    (lanSrc ? lanLoadFailed : !hasFrame)

  const placeholderText =
    camOnline === false
      ? t.camOffline
      : showPlaceholder
        ? t.camConnecting
        : null

  return (
    <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-[#0a1628] shadow-lg aspect-[16/10]">
      {displaySrc && !showPlaceholder ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displaySrc}
          alt=""
          className="block h-full w-full object-cover [image-rendering:auto]"
          onLoad={() => {
            setHasFrame(true)
            setLanLoadFailed(false)
          }}
          onError={() => {
            if (lanSrc) setLanLoadFailed(true)
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
