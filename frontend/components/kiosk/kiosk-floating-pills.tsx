"use client"

import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"
import styles from "./kiosk-floating-pills.module.css"

type Motion = "drift" | "spin" | "pulse" | "sway"

type PillConfig = {
  id: string
  /** placement within the arena box, in % (0-100) */
  left: number
  top: number
  size: number
  motion: Motion
  duration: number
  delay: number
  icon: ReactNode
}

const PILLS: PillConfig[] = [
  {
    id: "capsule",
    left: 12,
    top: 24,
    size: 46,
    motion: "drift",
    duration: 6,
    delay: 0,
    icon: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <rect x="5" y="11" width="22" height="10" rx="5" fill="#FFFFFF" stroke="#0B3C5D" strokeWidth="2" />
        <rect x="5" y="11" width="11" height="10" rx="5" fill="#328CC1" />
        <ellipse cx="9" cy="14" rx="2" ry="1" fill="#FFFFFF" opacity="0.6" />
      </svg>
    ),
  },
  {
    id: "herb",
    left: 84,
    top: 28,
    size: 50,
    motion: "sway",
    duration: 7,
    delay: -2,
    icon: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <ellipse cx="16" cy="21" rx="8" ry="3.5" fill="#0B3C5D" opacity="0.15" />
        <path d="M16 23 Q8 15 16 4 Q24 15 16 23" fill="#22C55E" stroke="#15803D" strokeWidth="1.5" />
        <path d="M16 21 L16 8 M16 14 L11 10 M16 12 L21 8" stroke="#15803D" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "vitamin-c",
    left: 10,
    top: 72,
    size: 44,
    motion: "pulse",
    duration: 5,
    delay: -1,
    icon: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <circle cx="16" cy="16" r="12" fill="#FB923C" stroke="#EA580C" strokeWidth="2" />
        <text x="16" y="21" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="bold" fontFamily="sans-serif">
          C
        </text>
        <ellipse cx="12" cy="11" rx="3" ry="1.6" fill="#FFFFFF" opacity="0.45" />
      </svg>
    ),
  },
  {
    id: "charcoal",
    left: 86,
    top: 70,
    size: 44,
    motion: "spin",
    duration: 14,
    delay: -3,
    icon: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <rect x="5" y="11" width="22" height="10" rx="5" fill="#1E293B" stroke="#0B3C5D" strokeWidth="2" />
        <rect x="16" y="11" width="11" height="10" rx="5" fill="#475569" />
        <ellipse cx="21" cy="14" rx="2" ry="1" fill="#FFFFFF" opacity="0.4" />
      </svg>
    ),
  },
  {
    id: "tablet",
    left: 26,
    top: 6,
    size: 40,
    motion: "drift",
    duration: 6.5,
    delay: -4,
    icon: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <circle cx="16" cy="16" r="11" fill="#FFFFFF" stroke="#0B3C5D" strokeWidth="2" />
        <line x1="16" y1="6" x2="16" y2="26" stroke="#328CC1" strokeWidth="2" />
        <ellipse cx="12" cy="11" rx="2.6" ry="1.4" fill="#328CC1" opacity="0.25" />
      </svg>
    ),
  },
  {
    id: "cross",
    left: 72,
    top: 92,
    size: 40,
    motion: "pulse",
    duration: 5.5,
    delay: -2.5,
    icon: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <rect x="5" y="5" width="22" height="22" rx="7" fill="#FFFFFF" stroke="#0B3C5D" strokeWidth="2" />
        <rect x="14" y="9" width="4" height="14" rx="1.5" fill="#328CC1" />
        <rect x="9" y="14" width="14" height="4" rx="1.5" fill="#328CC1" />
      </svg>
    ),
  },
]

type Props = {
  className?: string
}

export function KioskFloatingPills({ className }: Props) {
  return (
    <div className={cn(styles.container, className)} aria-hidden>
      {PILLS.map((pill) => (
        <span
          key={pill.id}
          className={cn(styles.pill, styles[pill.motion])}
          style={
            {
              left: `${pill.left}%`,
              top: `${pill.top}%`,
              "--size": `${pill.size}px`,
              "--duration": `${pill.duration}s`,
              "--delay": `${pill.delay}s`,
            } as CSSProperties
          }
        >
          {pill.icon}
        </span>
      ))}
    </div>
  )
}
