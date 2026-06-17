"use client"

import { useEffect } from "react"

export const FONT_SIZE_STORAGE_KEY = "laneya-font-size"

export type FontSizePref = "sm" | "md" | "lg"

export function readFontSizePref(): FontSizePref {
  if (typeof window === "undefined") return "md"
  const v = localStorage.getItem(FONT_SIZE_STORAGE_KEY)
  if (v === "sm" || v === "lg") return v
  return "md"
}

export function applyFontSizePref(pref: FontSizePref) {
  document.documentElement.dataset.fontSize = pref
}

export function FontSizeRoot() {
  useEffect(() => {
    applyFontSizePref(readFontSizePref())
  }, [])
  return null
}
