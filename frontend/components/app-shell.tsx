"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Toaster } from "@/components/ui/sonner"
import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const isFullscreenKiosk = pathname.includes("/admin/kiosk")

  if (isFullscreenKiosk) {
    return (
      <div className="min-h-[100dvh] bg-background">
        {children}
        <Toaster richColors position="top-center" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader onMenuClick={() => setSidebarOpen(true)} />
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 min-w-0 w-full px-3 pb-6 sm:px-4 md:px-6 lg:px-8">{children}</main>
      <Toaster richColors position="top-center" />
    </div>
  )
}
