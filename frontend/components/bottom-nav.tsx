"use client"

import { Link, usePathname } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Home, Bot, Ticket, UserCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { getStoredToken } from "@/lib/auth-token"

interface NavItem {
  href: string
  labelKey: "home" | "chat" | "history" | "profile" | "login"
  icon: typeof Home
  authRequired?: boolean
  guestOnly?: boolean
}

const navItems: NavItem[] = [
  { href: "/", labelKey: "home", icon: Home },
  { href: "/chat", labelKey: "chat", icon: Bot },
  { href: "/history", labelKey: "history", icon: Ticket },
  { href: "/profile", labelKey: "profile", icon: UserCircle, authRequired: true },
  { href: "/login", labelKey: "login", icon: UserCircle, guestOnly: true },
]

export function BottomNav() {
  const t = useTranslations("Nav")
  const pathname = usePathname()
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    const sync = () => setHasSession(!!getStoredToken())
    sync()
    window.addEventListener("laneya-auth", sync)
    return () => window.removeEventListener("laneya-auth", sync)
  }, [])

  useEffect(() => {
    setHasSession(!!getStoredToken())
  }, [pathname])

  const filteredItems = navItems.filter((item) => {
    if (item.authRequired && !hasSession) return false
    if (item.guestOnly && hasSession) return false
    return true
  })

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm md:hidden safe-area-bottom"
      role="navigation"
      aria-label="Main navigation"
    >
      <ul className="flex items-center justify-around px-2 py-2">
        {filteredItems.map((item) => {
          const active = isActive(item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg px-4 py-2 text-xs font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 transition-transform",
                    active && "scale-110"
                  )}
                />
                <span>{t(item.labelKey)}</span>
                {active && (
                  <span className="absolute -bottom-0.5 h-0.5 w-8 rounded-full bg-primary" />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
