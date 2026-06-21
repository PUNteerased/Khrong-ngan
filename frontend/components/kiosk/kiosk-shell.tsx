"use client"

import type { ReactNode } from "react"

type Props = {
  header: ReactNode
  banner: ReactNode
  main: ReactNode
  footer: ReactNode
}

export function KioskShell({ header, banner, main, footer }: Props) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      {header}
      {banner}
      <main className="min-h-0 flex-[65] overflow-hidden">{main}</main>
      {footer}
    </div>
  )
}
