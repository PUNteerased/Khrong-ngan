"use client"

import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"
import styles from "./kiosk-floating-pills.module.css"

type PillConfig = {
  id: string
  angle: number
  radius: number
  duration: number
  delay: number
  icon: ReactNode
}

const PILLS: PillConfig[] = [
  {
    id: "capsule",
    angle: 0,
    radius: 145,
    duration: 22,
    delay: 0,
    icon: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <rect x="6" y="12" width="20" height="8" rx="4" fill="#FFFFFF" stroke="#0B3C5D" strokeWidth="2" />
        <rect x="6" y="12" width="10" height="8" rx="4" fill="#328CC1" />
      </svg>
    ),
  },
  {
    id: "cross",
    angle: 60,
    radius: 155,
    duration: 20,
    delay: -3,
    icon: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <rect x="4" y="4" width="24" height="24" rx="6" fill="#FFFFFF" stroke="#0B3C5D" strokeWidth="2" />
        <rect x="14" y="9" width="4" height="14" rx="1" fill="#E53935" />
        <rect x="9" y="14" width="14" height="4" rx="1" fill="#E53935" />
      </svg>
    ),
  },
  {
    id: "herb",
    angle: 120,
    radius: 138,
    duration: 24,
    delay: -7,
    icon: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <ellipse cx="16" cy="20" rx="8" ry="4" fill="#F59E0B" opacity="0.9" />
        <path d="M16 22 Q10 14 16 6 Q22 14 16 22" fill="#22C55E" stroke="#15803D" strokeWidth="1.5" />
        <path d="M16 14 L12 10 M16 12 L20 8" stroke="#15803D" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "vitamin-c",
    angle: 180,
    radius: 150,
    duration: 18,
    delay: -5,
    icon: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <circle cx="16" cy="16" r="12" fill="#FB923C" stroke="#EA580C" strokeWidth="2" />
        <text x="16" y="21" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="bold" fontFamily="sans-serif">
          C
        </text>
      </svg>
    ),
  },
  {
    id: "tablet",
    angle: 240,
    radius: 142,
    duration: 21,
    delay: -11,
    icon: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <circle cx="16" cy="16" r="11" fill="#FFFFFF" stroke="#0B3C5D" strokeWidth="2" />
        <line x1="16" y1="8" x2="16" y2="24" stroke="#328CC1" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: "bandage",
    angle: 300,
    radius: 148,
    duration: 23,
    delay: -9,
    icon: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <rect x="6" y="10" width="20" height="12" rx="3" fill="#FEF3C7" stroke="#D97706" strokeWidth="2" />
        <circle cx="12" cy="16" r="1.5" fill="#D97706" />
        <circle cx="16" cy="16" r="1.5" fill="#D97706" />
        <circle cx="20" cy="16" r="1.5" fill="#D97706" />
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
          className={styles.pill}
          style={
            {
              "--orbit-angle": `${pill.angle}deg`,
              "--orbit-radius": `${pill.radius}px`,
              "--orbit-duration": `${pill.duration}s`,
              "--orbit-delay": `${pill.delay}s`,
            } as CSSProperties
          }
        >
          {pill.icon}
        </span>
      ))}
    </div>
  )
}
