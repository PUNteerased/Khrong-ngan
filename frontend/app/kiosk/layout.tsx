import type { Metadata, Viewport } from "next"
import "../globals.css"

export const metadata: Metadata = {
  title: "LaneYa Kiosk Display",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: "#023c75",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function KioskLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
