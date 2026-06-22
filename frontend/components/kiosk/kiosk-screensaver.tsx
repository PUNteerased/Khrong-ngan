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

const WAKE_ANIMATION_MS = 360
/** fraction of the track the knob must travel to unlock */
const UNLOCK_THRESHOLD = 0.85

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

  // ----- swipe-to-unlock slider -----
  const trackRef = useRef<HTMLDivElement>(null)
  const [knobX, setKnobX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const maxXRef = useRef(0)
  const startXRef = useRef(0)
  const progress = maxXRef.current > 0 ? knobX / maxXRef.current : 0

  const triggerWake = useCallback(() => {
    if (waking) return
    setWaking(true)
    window.setTimeout(() => onWake(), WAKE_ANIMATION_MS)
  }, [onWake, waking])

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

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (waking) return
      e.currentTarget.setPointerCapture(e.pointerId)
      measure()
      startXRef.current = e.clientX - knobX
      setDragging(true)
    },
    [knobX, measure, waking],
  )

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!dragging) return
      const max = maxXRef.current
      const next = Math.min(Math.max(e.clientX - startXRef.current, 0), max)
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

  // keyboard / click fallback for accessibility
  const handleActivate = useCallback(() => {
    const max = measure()
    setKnobX(max)
    triggerWake()
  }, [measure, triggerWake])

  useEffect(() => {
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [measure])

  // ----- mascot wander: occasional gentle stroll, not constant -----
  const [wander, setWander] = useState({ x: 0, y: 0 })
  useEffect(() => {
    if (waking) return
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduce) return

    let timer: number
    const schedule = () => {
      // pause at center sometimes, wander other times
      const delay = 2600 + Math.random() * 3200
      timer = window.setTimeout(() => {
        const roam = Math.random() > 0.35
        setWander(
          roam
            ? {
                x: Math.round((Math.random() - 0.5) * 120),
                y: Math.round((Math.random() - 0.5) * 44),
              }
            : { x: 0, y: 0 },
        )
        schedule()
      }, delay)
    }
    schedule()
    return () => window.clearTimeout(timer)
  }, [waking])

  return (
    <div
      className={cn(
        styles.root,
        waking && styles.waking,
        "flex h-[100dvh] w-full flex-col items-center justify-between px-6 py-8 text-white sm:py-12",
      )}
    >
      {/* background texture */}
      <span className={styles.grid} aria-hidden />

      {/* Top control bar: language + mute */}
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

      {/* Title */}
      <header className={cn(styles.content, "flex flex-col items-center gap-2")}>
        <h1 className="text-center text-[clamp(2.5rem,8vw,4rem)] font-extrabold leading-none tracking-tight text-balance">
          {t.title}
        </h1>
        <p className="text-[clamp(0.95rem,3vw,1.2rem)] font-semibold tracking-[0.18em] text-sky-200/85">
          {t.screensaverSubtitle}
        </p>
      </header>

      {/* Mascot arena */}
      <div className={cn(styles.content, styles.arena)}>
        <KioskFloatingPills />
        <div
          className={styles.wander}
          style={{ transform: `translate(${wander.x}px, ${wander.y}px)` }}
        >
          <KioskMascotCapsi variant={waking ? "happy" : "idle"} celebrating={waking} />
        </div>
      </div>

      {/* Swipe-to-unlock slider */}
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
