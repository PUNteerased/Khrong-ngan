"use client"

import { useEffect, useState } from "react"
import { BookOpenText, Database, Home, MessageCircle, Ticket, User } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link, usePathname } from "@/i18n/navigation"
import { getStoredToken } from "@/lib/auth-token"
import { fetchMe } from "@/lib/api"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/", icon: Home, key: "home" },
  { href: "/knowledge", icon: Database, key: "knowledge" },
  { href: "/health-tips", icon: BookOpenText, key: "healthTips" },
  { href: "/chat", icon: MessageCircle, key: "chat" },
  { href: "/tickets", icon: Ticket, key: "tickets" },
  { href: "/profile", icon: User, key: "profile" },
] as const

export function BottomNav() {
  const t = useTranslations("Nav")
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!getStoredToken()) return
    let cancelled = false
    ;(async () => {
      try {
        const me = await fetchMe()
        if (!cancelled) setIsAdmin(!!me.isAdmin)
      } catch {
        if (!cancelled) setIsAdmin(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const navItems = isAdmin
    ? [...NAV_ITEMS, { href: "/admin", icon: User, key: "admin" as const }]
    : NAV_ITEMS

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur lg:hidden">
      <div className={cn("grid h-16", isAdmin ? "grid-cols-7" : "grid-cols-6")}>
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[11px] transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{t(item.key)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

