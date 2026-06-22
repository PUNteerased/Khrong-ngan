"use client"

import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"
import styles from "./kiosk-mascot-capsi.module.css"

type Props = {
  variant?: "idle" | "happy"
  celebrating?: boolean
  flying?: boolean
  tiltDeg?: number
  className?: string
}

export function KioskMascotCapsi({
  variant = "idle",
  celebrating = false,
  flying = false,
  tiltDeg = 0,
  className,
}: Props) {
  const isHappy = variant === "happy"

  return (
    <div
      className={cn(
        styles.container,
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
      {/* Soft glowing halo behind the robot */}
      <span className={styles.halo} />

      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 320 380"
        width="100%"
        height="100%"
        className={styles.svg}
      >
        <defs>
          {/* Glossy top dome gradient */}
          <linearGradient id="capsi-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3E7FB0" />
            <stop offset="45%" stopColor="#1E5C8A" />
            <stop offset="100%" stopColor="#0B3C5D" />
          </linearGradient>
          {/* Clean medical white body gradient */}
          <linearGradient id="capsi-bottom" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#DCEAF4" />
          </linearGradient>
          {/* Glass faceplate gradient */}
          <linearGradient id="capsi-glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1B2A3F" />
            <stop offset="100%" stopColor="#0A1626" />
          </linearGradient>
          {/* Cyan eye glow */}
          <radialGradient id="capsi-eye" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#A5F3FC" />
            <stop offset="55%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0EA5E9" />
          </radialGradient>
          <clipPath id="capsi-visor-clip">
            <rect x="111" y="103" width="102" height="62" rx="21" />
          </clipPath>
        </defs>

        {/* Floor shadow */}
        <ellipse
          className={styles.shadow}
          cx="160"
          cy="346"
          rx="64"
          ry="13"
          fill="#000"
          opacity="0.22"
        />

        <g className={styles.robot}>
          {/* Little legs / feet */}
          <path d="M120 250 L115 277 Q115 282 120 282 L131 277 Z" fill="#0B3C5D" />
          <path d="M200 250 L205 277 Q205 282 200 282 L189 277 Z" fill="#0B3C5D" />
          <ellipse cx="122" cy="280" rx="6" ry="2.4" fill="#38BDF8" />
          <ellipse cx="198" cy="280" rx="6" ry="2.4" fill="#38BDF8" />

          {/* Arms */}
          <path d="M84 168 Q56 180 68 208 Q74 214 80 202 L92 180 Z" fill="#0B3C5D" />
          <path d="M236 168 Q264 180 252 208 Q246 214 240 202 L228 180 Z" fill="#0B3C5D" />
          <circle className={styles.handL} cx="70" cy="206" r="9" fill="#328CC1" />
          <circle className={styles.handR} cx="250" cy="206" r="9" fill="#328CC1" />

          {/* Capsule top half (deep blue, glossy) */}
          <path
            d="M90 150 L90 140 A 70 70 0 0 1 230 140 L230 150 Z"
            fill="url(#capsi-top)"
          />
          {/* Glossy highlight streak on dome */}
          <path
            d="M112 96 A 60 60 0 0 1 168 84"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="7"
            strokeLinecap="round"
            opacity="0.28"
          />

          {/* Capsule bottom half (medical white) */}
          <path
            d="M90 150 L90 190 A 70 70 0 0 0 230 190 L230 150 Z"
            fill="url(#capsi-bottom)"
            stroke="#0B3C5D"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Capsule seam */}
          <line x1="88" y1="150" x2="232" y2="150" stroke="#328CC1" strokeWidth="6" />

          {/* Glass faceplate */}
          <rect
            x="108"
            y="102"
            width="104"
            height="64"
            rx="22"
            fill="url(#capsi-glass)"
            stroke="#328CC1"
            strokeWidth="3"
          />
          {/* Faceplate glossy reflection */}
          <rect x="116" y="108" width="40" height="14" rx="7" fill="#FFFFFF" opacity="0.12" />

          {/* Blush */}
          <ellipse cx="124" cy="150" rx="8" ry="5" fill="#FF9DB4" opacity="0.55" />
          <ellipse cx="196" cy="150" rx="8" ry="5" fill="#FF9DB4" opacity="0.55" />

          {/* Eyes — ry animation keeps pupils inside the visor (no CSS scaleY) */}
          <g clipPath="url(#capsi-visor-clip)">
            {isHappy ? (
              <>
                <path
                  d="M138 138 C138 128 144 122 150 126 C156 122 162 128 162 138 C162 148 150 156 150 156 C150 156 138 148 138 138 Z"
                  fill="#22D3EE"
                />
                <path
                  d="M182 138 C182 128 188 122 194 126 C200 122 206 128 206 138 C206 148 194 156 194 156 C194 156 182 148 182 138 Z"
                  fill="#22D3EE"
                />
              </>
            ) : (
              <>
                <g className={styles.eyeL}>
                  <ellipse cx="142" cy="132" rx="9" ry="13" fill="url(#capsi-eye)">
                    <animate
                      attributeName="ry"
                      values="13;13;1.5;13;13"
                      keyTimes="0;0.86;0.93;0.96;1"
                      dur="4.5s"
                      repeatCount="indefinite"
                    />
                  </ellipse>
                  <circle cx="139" cy="127" r="3" fill="#FFFFFF">
                    <animate
                      attributeName="opacity"
                      values="1;1;0;1;1"
                      keyTimes="0;0.86;0.93;0.96;1"
                      dur="4.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
                <g className={styles.eyeR}>
                  <ellipse cx="186" cy="132" rx="9" ry="13" fill="url(#capsi-eye)">
                    <animate
                      attributeName="ry"
                      values="13;13;1.5;13;13"
                      keyTimes="0;0.86;0.93;0.96;1"
                      dur="4.5s"
                      repeatCount="indefinite"
                    />
                  </ellipse>
                  <circle cx="183" cy="127" r="3" fill="#FFFFFF">
                    <animate
                      attributeName="opacity"
                      values="1;1;0;1;1"
                      keyTimes="0;0.86;0.93;0.96;1"
                      dur="4.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
              </>
            )}
          </g>

          {/* Antenna */}
          <path d="M160 75 L160 58" stroke="#328CC1" strokeWidth="4" strokeLinecap="round" />
          <circle className={styles.antenna} cx="160" cy="52" r="7" fill="#38BDF8" />
        </g>
      </svg>
    </div>
  )
}
