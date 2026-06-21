import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "LaneYa Kiosk Display",
  robots: { index: false, follow: false },
}

export default function AdminKioskLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
