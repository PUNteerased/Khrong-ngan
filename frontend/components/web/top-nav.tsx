"use client"

import { useEffect, useState } from "react"
import { BookOpenText, Database, Home, MessageCircle, Ticket, User } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link, usePathname } from "@/i18n/navigation"
import { getStoredToken } from "@/lib/auth-token"
import { fetchMe } from "@/lib/api"
import { cn } from "@/lib/utils"
import { LanguageSwitcher } from "@/components/language-switcher"

const NAV_ITEMS = [
  { href: "/", icon: Home, key: "home" },
  { href: "/knowledge", icon: Database, key: "knowledge" },
  { href: "/health-tips", icon: BookOpenText, key: "healthTips" },
  { href: "/chat", icon: MessageCircle, key: "chat" },
  { href: "/tickets", icon: Ticket, key: "tickets" },
  { href: "/profile", icon: User, key: "profile" },
] as const

export function TopNav() {
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
    <header className="sticky top-0 z-40 hidden border-b bg-background/90 backdrop-blur lg:block">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-base font-semibold text-primary">
          LaneYa
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {t(item.key)}
              </Link>
            )
          })}
        </nav>
        <LanguageSwitcher />
      </div>
    </header>
  )
}

