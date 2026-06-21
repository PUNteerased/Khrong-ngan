"use client"

import { useEffect, useMemo, useState } from "react"
import { getKioskCameraFrameUrl } from "@/lib/kiosk-api"
import { isKioskLanMode } from "@/lib/kiosk-connectivity"
import type { KioskMessages } from "@/lib/kiosk-i18n"

const POLL_MS = 400

type Props = {
  t: KioskMessages
  active: boolean
  camPreviewUrl?: string
}

export function KioskCameraViewport({ t, active, camPreviewUrl }: Props) {
  const [tick, setTick] = useState(0)
  const [imageFailed, setImageFailed] = useState(false)

  const src = useMemo(() => {
    if (!active) return null
    const base = isKioskLanMode()
      ? camPreviewUrl
      : getKioskCameraFrameUrl()
    if (!base) return null
    const sep = base.includes("?") ? "&" : "?"
    return `${base}${sep}t=${tick}`
  }, [active, camPreviewUrl, tick])

  useEffect(() => {
    if (!active) {
      setImageFailed(false)
      return
    }
    setImageFailed(false)
    const id = window.setInterval(() => {
      setTick(Date.now())
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [active, camPreviewUrl])

  const showPlaceholder = !src || imageFailed

  return (
    <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-[#0a1628] shadow-lg aspect-[16/10]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          className={`h-full w-full object-cover ${showPlaceholder ? "hidden" : "block"}`}
          onLoad={() => setImageFailed(false)}
          onError={() => setImageFailed(true)}
        />
      ) : null}
      {showPlaceholder ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-base text-slate-400">
          {t.camConnecting}
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
