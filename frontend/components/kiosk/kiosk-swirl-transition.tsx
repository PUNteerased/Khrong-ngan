"use client"

import { useEffect, useRef } from "react"
import styles from "./kiosk-swirl-transition.module.css"

type Props = {
  /** Fired when the screen is fully white (safe to swap the screen behind). */
  onCovered: () => void
  /** Fired when the swirl has fully cleared and the overlay can unmount. */
  onDone: () => void
}

const COVER_MS = 500 // swirl grows + screen turns white
const HOLD_MS = 500 // stay white
const REVEAL_MS = 450 // swirl clears to reveal the new screen

export function KioskSwirlTransition({ onCovered, onDone }: Props) {
  const coveredRef = useRef(onCovered)
  const doneRef = useRef(onDone)
  coveredRef.current = onCovered
  doneRef.current = onDone

  useEffect(() => {
    const coverTimer = window.setTimeout(() => coveredRef.current(), COVER_MS)
    const doneTimer = window.setTimeout(
      () => doneRef.current(),
      COVER_MS + HOLD_MS + REVEAL_MS,
    )
    return () => {
      window.clearTimeout(coverTimer)
      window.clearTimeout(doneTimer)
    }
  }, [])

  return (
    <div className={styles.overlay} aria-hidden>
      <span className={styles.swirl} />
      <span className={styles.swirlAlt} />
      <span className={styles.veil} />
    </div>
  )
}
