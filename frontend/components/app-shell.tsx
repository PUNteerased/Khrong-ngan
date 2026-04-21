"use client"

import { useState } from "react"
import { Toaster } from "@/components/ui/sonner"
import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"
import { BottomNav } from "@/components/bottom-nav"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <AppHeader onMenuClick={() => setSidebarOpen(true)} />
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 min-w-0 w-full px-3 pb-20 sm:px-4 md:px-6 md:pb-6 lg:px-8">
        {children}
      </main>
      <BottomNav />
      <Toaster richColors position="top-center" />
    </div>
  )
}
