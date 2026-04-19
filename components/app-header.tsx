"use client"

import { Menu, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppLogo } from "@/components/app-logo"
import Link from "next/link"

interface AppHeaderProps {
  onMenuClick: () => void
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-primary text-primary-foreground shadow-md">
      <div className="flex items-center justify-between px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="text-primary-foreground hover:bg-primary/80"
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">เปิดเมนู</span>
        </Button>

        <Link href="/" className="flex items-center gap-2">
          <AppLogo size={36} className="rounded-md" priority />
          <span className="text-2xl font-bold">LaneYa</span>
        </Link>

        <Button
          variant="ghost"
          size="icon"
          className="text-primary-foreground hover:bg-primary/80"
        >
          <Bell className="h-5 w-5" />
          <span className="sr-only">การแจ้งเตือน</span>
        </Button>
      </div>
    </header>
  )
}
