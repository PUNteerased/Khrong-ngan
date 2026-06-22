"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { cn } from "@/lib/utils"
import styles from "./kiosk-mascot-capsi.module.css"

type Props = {
  variant?: "idle" | "happy"
  celebrating?: boolean
  flying?: boolean
  tiltDeg?: number
  className?: string
}

const CAPSI_SVG_URL = "/kiosk/capsi-mascot.svg"

function prepareCapsiSvg(svg: string): string {
  return svg.replace("<svg ", '<svg width="100%" height="100%" class="capsi-svg" ')
}

export function KioskMascotCapsi({
  variant = "idle",
  celebrating = false,
  flying = false,
  tiltDeg = 0,
  className,
}: Props) {
  const isHappy = variant === "happy"
  const [svgHtml, setSvgHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch(CAPSI_SVG_URL)
      .then((res) => res.text())
      .then((text) => {
        if (!cancelled) setSvgHtml(prepareCapsiSvg(text))
      })
      .catch(() => {
        if (!cancelled) setSvgHtml(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      className={cn(
        styles.container,
        isHappy && styles.happyVariant,
        celebrating && styles.celebrate,
        flying && styles.flying,
        className,
      )}
      style={
        flying
          ? ({ "--wander-tilt": `${tiltDeg}deg` } as CSSProperties)
          : undefined
      }
      aria-hidden
    >
      <span className={styles.halo} />
      {svgHtml ? (
        <div
          className={styles.svgWrap}
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      ) : null}
    </div>
  )
}
