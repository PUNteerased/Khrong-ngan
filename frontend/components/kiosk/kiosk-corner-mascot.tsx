"use client"

import { KioskMascotCapsi } from "@/components/kiosk/kiosk-mascot-capsi"
import { cn } from "@/lib/utils"
import styles from "./kiosk-corner-mascot.module.css"

type Props = {
  label: string
  onClick: () => void
  className?: string
}

/**
 * A shrunken Capsi that "lands" in the bottom-left corner of the home screen.
 * Tapping it opens the help / chat dialog.
 */
export function KioskCornerMascot({ label, onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        styles.root,
        "fixed bottom-4 left-4 z-20 flex items-end gap-2 safe-bottom",
        className,
      )}
    >
      <span className={styles.bubble} aria-hidden>
        {label}
      </span>
      <span className={styles.mascot}>
        <KioskMascotCapsi variant="happy" />
      </span>
      <span className={styles.ping} aria-hidden />
    </button>
  )
}
