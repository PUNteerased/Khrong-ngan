"use client"

import { KIOSK_SCAN_DURATION_SEC } from "@/lib/kiosk-constants"

type Props = {
  seconds: number
}

const SIZE = 144
const STROKE = 10
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R

export function KioskCountdownRing({ seconds }: Props) {
  const progress = Math.max(0, Math.min(1, seconds / KIOSK_SCAN_DURATION_SEC))
  const offset = C * (1 - progress)

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
      aria-live="polite"
    >
      <svg width={SIZE} height={SIZE} className="-rotate-90" aria-hidden>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-primary/15"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          className="text-primary transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      <span className="absolute text-[4rem] font-bold tabular-nums text-primary">
        {seconds}
      </span>
    </div>
  )
}
