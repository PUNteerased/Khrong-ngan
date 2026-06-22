"use client"

import { cn } from "@/lib/utils"
import styles from "./kiosk-mascot-capsi.module.css"

type Props = {
  variant?: "idle" | "happy"
  celebrating?: boolean
  className?: string
}

export function KioskMascotCapsi({
  variant = "idle",
  celebrating = false,
  className,
}: Props) {
  const isHappy = variant === "happy"

  return (
    <div
      className={cn(
        styles.container,
        celebrating && styles.celebrate,
        className,
      )}
      aria-hidden
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 320 380"
        width="100%"
        height="100%"
      >
        <ellipse
          className={styles.shadow}
          cx="160"
          cy="340"
          rx="60"
          ry="12"
          fill="#000"
          opacity="0.2"
        />

        <g className={styles.robot}>
          <path
            d="M120 250 L115 275 Q115 280 120 280 L130 275 Z"
            fill="#328CC1"
          />
          <path
            d="M200 250 L205 275 Q205 280 200 280 L190 275 Z"
            fill="#328CC1"
          />
          <ellipse cx="121" cy="278" rx="5" ry="2" fill="#FFD700" />
          <ellipse cx="199" cy="278" rx="5" ry="2" fill="#FFD700" />

          <path
            d="M85 170 Q60 180 70 205 Q75 210 80 200 L90 180 Z"
            fill="#0B3C5D"
          />
          <path
            d="M235 170 Q260 180 250 205 Q245 210 240 200 L230 180 Z"
            fill="#0B3C5D"
          />

          <path
            d="M90 150 L90 140 A 70 70 0 0 1 230 140 L230 150 Z"
            fill="#0B3C5D"
          />
          <path
            d="M90 150 L90 190 A 70 70 0 0 0 230 190 L230 150 Z"
            fill="#FFFFFF"
            stroke="#0B3C5D"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <line
            x1="88"
            y1="150"
            x2="232"
            y2="150"
            stroke="#328CC1"
            strokeWidth="6"
          />

          <rect
            x="110"
            y="105"
            width="100"
            height="60"
            rx="20"
            fill="#1E293B"
            stroke="#328CC1"
            strokeWidth="3"
          />

          <circle cx="125" cy="148" r="7" fill="#FFAAAA" opacity="0.8" />
          <circle cx="195" cy="148" r="7" fill="#FFAAAA" opacity="0.8" />

          <g className={styles.eyes}>
            {isHappy ? (
              <>
                <path
                  d="M140 138 C140 128 146 122 152 126 C158 122 164 128 164 138 C164 148 152 156 152 156 C152 156 140 148 140 138 Z"
                  fill="#FF6B9D"
                />
                <path
                  d="M180 138 C180 128 186 122 192 126 C198 122 204 128 204 138 C204 148 192 156 192 156 C192 156 180 148 180 138 Z"
                  fill="#FF6B9D"
                />
              </>
            ) : (
              <>
                <ellipse cx="140" cy="130" rx="8" ry="12" fill="#38BDF8" />
                <ellipse cx="180" cy="130" rx="8" ry="12" fill="#38BDF8" />
                <circle cx="138" cy="125" r="3" fill="#FFFFFF" />
                <circle cx="178" cy="125" r="3" fill="#FFFFFF" />
              </>
            )}
          </g>

          <circle cx="85" cy="135" r="8" fill="#328CC1" />
          <circle cx="235" cy="135" r="8" fill="#328CC1" />
          <path
            d="M160 75 L160 60"
            stroke="#328CC1"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="160" cy="56" r="6" fill="#FFD700" />
        </g>
      </svg>
    </div>
  )
}
