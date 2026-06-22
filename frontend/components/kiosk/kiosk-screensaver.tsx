"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { ChevronsRight, Pointer, Volume2, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"
import { KioskFloatingPills } from "@/components/kiosk/kiosk-floating-pills"
import { KioskMascotCapsi } from "@/components/kiosk/kiosk-mascot-capsi"
import type { KioskLocale } from "@/lib/kiosk-api"
import type { KioskMessages } from "@/lib/kiosk-i18n"
import styles from "./kiosk-screensaver.module.css"

const WAKE_FLIGHT_MS = 2200
/** knob must reach the end of the track to unlock */
const UNLOCK_THRESHOLD = 1
/** pointer movement before we treat it as a drag (not a tap) */
const DRAG_THRESHOLD_PX = 8
const MARGIN = 12
const TOP_RESERVE = 100
const BOTTOM_RESERVE = 130
const MASCOT_FALLBACK = { w: 280, h: 330 }

type Point = { x: number; y: number }
type Bounds = { minX: number; maxX: number; minY: number; maxY: number }

function getFlightBounds(
  layerW: number,
  layerH: number,
  mascotW: number,
  mascotH: number,
): Bounds {
  return {
    minX: MARGIN,
    maxX: Math.max(MARGIN, layerW - mascotW - MARGIN),
    minY: TOP_RESERVE,
    maxY: Math.max(TOP_RESERVE, layerH - mascotH - BOTTOM_RESERVE),
  }
}

function randomPoint(bounds: Bounds): Point {
  return {
    x: Math.round(bounds.minX + Math.random() * (bounds.maxX - bounds.minX)),
    y: Math.round(bounds.minY + Math.random() * (bounds.maxY - bounds.minY)),
  }
}

function centerPoint(bounds: Bounds, mascotW: number, mascotH: number): Point {
  return {
    x: Math.round((bounds.minX + bounds.maxX - mascotW) / 2),
    y: Math.round((bounds.minY + bounds.maxY - mascotH) / 2),
  }
}

type Props = {
  t: KioskMessages
  locale: KioskLocale
  ttsOn: boolean
  onLocaleChange: (locale: KioskLocale) => void
  onTtsToggle: () => void
  onWake: () => void
}

export function KioskScreensaver({
  t,
  locale,
  ttsOn,
  onLocaleChange,
  onTtsToggle,
  onWake,
}: Props) {
  const [waking, setWaking] = useState(false)
  const layerRef = useRef<HTMLDivElement>(null)
  const flyerRef = useRef<HTMLDivElement>(null)
  const prevPosRef = useRef<Point>({ x: 0, y: 0 })
  const wakeTimersRef = useRef<number[]>([])

  const [pos, setPos] = useState<Point>({ x: 0, y: 0 })
  const [tiltDeg, setTiltDeg] = useState(0)
  const [posReady, setPosReady] = useState(false)

  // ----- swipe-to-unlock slider -----
  const trackRef = useRef<HTMLDivElement>(null)
  const [knobX, setKnobX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const maxXRef = useRef(0)
  const startXRef = useRef(0)
  const didDragRef = useRef(false)
  const pointerDownXRef = useRef(0)
  const progress = maxXRef.current > 0 ? knobX / maxXRef.current : 0

  const measureMascot = useCallback(() => {
    const flyer = flyerRef.current
    const layer = layerRef.current
    if (!flyer || !layer) return null
    const mascotW = flyer.offsetWidth || MASCOT_FALLBACK.w
    const mascotH = flyer.offsetHeight || MASCOT_FALLBACK.h
    return getFlightBounds(layer.clientWidth, layer.clientHeight, mascotW, mascotH)
  }, [])

  const updateTilt = useCallback((next: Point) => {
    const dx = next.x - prevPosRef.current.x
    prevPosRef.current = next
    if (Math.abs(dx) < 2) return
    setTiltDeg(dx > 0 ? 10 : -10)
  }, [])

  const moveTo = useCallback(
    (next: Point) => {
      updateTilt(next)
      setPos(next)
    },
    [updateTilt],
  )

  const runWakeFlight = useCallback(() => {
    const bounds = measureMascot()
    if (!bounds) {
      window.setTimeout(() => onWake(), WAKE_FLIGHT_MS)
      return
    }

    const wp1 = randomPoint(bounds)
    const wp2 = randomPoint(bounds)
    const bottomRight: Point = {
      x: bounds.maxX,
      y: bounds.maxY,
    }

    wakeTimersRef.current.push(
      window.setTimeout(() => moveTo(wp1), 80),
      window.setTimeout(() => moveTo(wp2), 650),
      window.setTimeout(() => moveTo(bottomRight), 1250),
      window.setTimeout(() => onWake(), WAKE_FLIGHT_MS),
    )
  }, [measureMascot, moveTo, onWake])

  const triggerWake = useCallback(() => {
    if (waking) return
    setWaking(true)
    runWakeFlight()
  }, [runWakeFlight, waking])

  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track) return 0
    const knob = track.querySelector<HTMLElement>(`.${styles.knob}`)
    const pad = 6
    const knobW = knob?.offsetWidth ?? 64
    const max = Math.max(0, track.clientWidth - knobW - pad * 2)
    maxXRef.current = max
    return max
  }, [])

  const handleActivate = useCallback(() => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    const max = measure()
    setKnobX(max)
    triggerWake()
  }, [measure, triggerWake])

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (waking) return
      e.currentTarget.setPointerCapture(e.pointerId)
      measure()
      startXRef.current = e.clientX - knobX
      pointerDownXRef.current = e.clientX
      didDragRef.current = false
      setDragging(true)
    },
    [knobX, measure, waking],
  )

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!dragging) return
      const max = maxXRef.current
      const next = Math.min(Math.max(e.clientX - startXRef.current, 0), max)
      if (
        !didDragRef.current &&
        Math.abs(e.clientX - pointerDownXRef.current) >= DRAG_THRESHOLD_PX
      ) {
        didDragRef.current = true
      }
      setKnobX(next)
      if (max > 0 && next >= max * UNLOCK_THRESHOLD) {
        setDragging(false)
        setKnobX(max)
        triggerWake()
      }
    },
    [dragging, triggerWake],
  )

  const handlePointerUp = useCallback(() => {
    if (!dragging) return
    setDragging(false)
    if (!waking) setKnobX(0)
  }, [dragging, waking])

  useEffect(() => {
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [measure])

  // Center mascot on first layout
  useEffect(() => {
    const init = () => {
      const bounds = measureMascot()
      const flyer = flyerRef.current
      if (!bounds || !flyer) return
      const mascotW = flyer.offsetWidth || MASCOT_FALLBACK.w
      const mascotH = flyer.offsetHeight || MASCOT_FALLBACK.h
      const center = centerPoint(bounds, mascotW, mascotH)
      prevPosRef.current = center
      setPos(center)
      setPosReady(true)
    }
    init()
    window.addEventListener("resize", init)
    return () => window.removeEventListener("resize", init)
  }, [measureMascot])

  // Free roam across the full screen
  useEffect(() => {
    if (waking || !posReady) return
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduce) return

    let timer: number
    const schedule = () => {
      const delay = 1600 + Math.random() * 1800
      timer = window.setTimeout(() => {
        const bounds = measureMascot()
        if (bounds) moveTo(randomPoint(bounds))
        schedule()
      }, delay)
    }
    schedule()
    return () => window.clearTimeout(timer)
  }, [measureMascot, moveTo, posReady, waking])

  useEffect(
    () => () => {
      wakeTimersRef.current.forEach((id) => window.clearTimeout(id))
    },
    [],
  )

  return (
    <div
      className={cn(
        styles.root,
        waking && styles.waking,
        "flex h-[100dvh] w-full flex-col items-center justify-between px-6 py-8 text-white sm:py-12",
      )}
    >
      <span className={styles.grid} aria-hidden />

      <div ref={layerRef} className={styles.mascotLayer} aria-hidden>
        <KioskFloatingPills />
        <div
          ref={flyerRef}
          className={cn(
            styles.mascotFlyer,
            posReady && styles.mascotFlyerReady,
            waking && styles.mascotWake,
          )}
          style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
        >
          <KioskMascotCapsi flying tiltDeg={tiltDeg} />
        </div>
      </div>

      <div className={cn(styles.content, "flex w-full items-center justify-end gap-2")}>
        <div className="flex overflow-hidden rounded-2xl border border-white/25 bg-white/10 text-base font-bold backdrop-blur-sm">
          <button
            type="button"
            onClick={() => onLocaleChange("th")}
            className={cn(
              "min-h-12 min-w-14 px-3 transition-colors",
              locale === "th" ? "bg-white text-[#0B3C5D]" : "text-white/90",
            )}
          >
            {t.langTh}
          </button>
          <button
            type="button"
            onClick={() => onLocaleChange("en")}
            className={cn(
              "min-h-12 min-w-14 px-3 transition-colors",
              locale === "en" ? "bg-white text-[#0B3C5D]" : "text-white/90",
            )}
          >
            {t.langEn}
          </button>
        </div>
        <button
          type="button"
          onClick={onTtsToggle}
          aria-pressed={ttsOn}
          title={ttsOn ? t.ttsOff : t.ttsOn}
          className="flex min-h-12 min-w-12 items-center justify-center rounded-2xl border border-white/25 bg-white/10 text-white backdrop-blur-sm"
        >
          {ttsOn ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
          <span className="sr-only">{ttsOn ? t.ttsOff : t.ttsOn}</span>
        </button>
      </div>

      <header className={cn(styles.content, "flex flex-col items-center")}>
        <h1 className="text-center text-[clamp(2.5rem,8vw,4rem)] font-extrabold leading-none tracking-tight text-balance">
          {t.title}
        </h1>
      </header>

      <div className={cn(styles.content, styles.spacer)} aria-hidden />

      <div className={cn(styles.content, "flex w-full max-w-md flex-col items-center gap-3")}>
        <div
          ref={trackRef}
          role="button"
          tabIndex={0}
          aria-label={t.screensaverSwipe}
          onClick={handleActivate}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              handleActivate()
            }
          }}
          className={styles.track}
          style={{ "--progress": progress } as CSSProperties}
        >
          <span className={styles.trackFill} aria-hidden />
          <span className={styles.trackLabel}>
            {t.screensaverSwipe}
            <ChevronsRight className={styles.chevrons} aria-hidden />
          </span>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className={styles.knob}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              transform: `translateX(${knobX}px)`,
              transition: dragging ? "none" : "transform 0.28s cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <Pointer className="h-7 w-7" />
          </button>
        </div>
      </div>
    </div>
  )
}
