"use client"

import { Link, usePathname } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import {
  Home,
  Database,
  Stethoscope,
  Pill,
  Bot,
  ShieldCheck,
  UserPlus,
  LogIn,
  Phone,
  Settings,
  Cookie,
  ChevronDown,
  X,
  UserCircle,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AppLogo } from "@/components/app-logo"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useEffect, useState } from "react"
import { getStoredToken, setStoredToken } from "@/lib/auth-token"
import { fetchMe, ApiError } from "@/lib/api"

interface AppSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
  const t = useTranslations("Nav")
  const pathname = usePathname()
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [isAdminUser, setIsAdminUser] = useState(false)

  const knowledgeSubItems = [
    { href: "/knowledge?tab=disease", label: t("disease"), icon: Stethoscope },
    { href: "/knowledge?tab=symptom", label: t("symptom"), icon: Stethoscope },
    { href: "/knowledge?tab=drug", label: t("drug"), icon: Pill },
  ]

  const publicNavItems: Array<{
    href: string
    label: string
    icon: LucideIcon
    hasChildren?: boolean
  }> = [
    { href: "/", label: t("home"), icon: Home },
    {
      href: "/knowledge",
      label: t("knowledge"),
      icon: Database,
      hasChildren: true,
    },
    { href: "/chat", label: t("chat"), icon: Bot },
  ]

  const adminNavItem = {
    href: "/admin",
    label: t("admin"),
    icon: ShieldCheck,
  } as const

  const guestAuthItems = [
    { href: "/register", label: t("register"), icon: UserPlus },
    { href: "/login", label: t("login"), icon: LogIn },
  ]

  const profileItem = {
    href: "/profile",
    label: t("profile"),
    icon: UserCircle,
  } as const

  const utilityItems: Array<{ href: string; label: string; icon: LucideIcon }> =
    [
      { href: "/settings", label: t("settings"), icon: Settings },
      { href: "/cookies", label: t("cookies"), icon: Cookie },
      { href: "/contact", label: t("contact"), icon: Phone },
    ]

  useEffect(() => {
    const sync = () => setHasSession(!!getStoredToken())
    sync()
    window.addEventListener("laneya-auth", sync)
    return () => window.removeEventListener("laneya-auth", sync)
  }, [])

  useEffect(() => {
    setHasSession(!!getStoredToken())
  }, [pathname])

  useEffect(() => {
    if (!hasSession) {
      setIsAdminUser(false)
      return
    }
    let cancelled = false
    fetchMe()
      .then((u) => {
        if (!cancelled) setIsAdminUser(u.isAdmin)
      })
      .catch((err) => {
        if (!cancelled) setIsAdminUser(false)
        if (
          err instanceof ApiError &&
          err.status === 401 &&
          typeof window !== "undefined"
        ) {
          setStoredToken(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [hasSession])

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-72 bg-sidebar text-sidebar-foreground transform transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <Link href="/" className="flex items-center gap-2" onClick={onClose}>
            <AppLogo size={36} className="rounded-md shrink-0" priority />
            <span className="text-2xl font-bold text-sidebar-foreground">
              LaneYa
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 flex flex-col min-h-0">
          <div className="space-y-1">
            {publicNavItems.map((item) =>
              item.hasChildren ? (
                <Collapsible
                  key={item.href}
                  open={knowledgeOpen}
                  onOpenChange={setKnowledgeOpen}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        pathname.startsWith("/knowledge")
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-5 w-5" />
                        {item.label}
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          knowledgeOpen && "rotate-180"
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-6 mt-1 space-y-1">
                    {knowledgeSubItems.map((subItem) => (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                          pathname === subItem.href ||
                            (pathname === "/knowledge" &&
                              subItem.href.includes("disease"))
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                        )}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {subItem.label}
                      </Link>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            )}
            {isAdminUser ? (
              <Link
                href={adminNavItem.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  pathname === adminNavItem.href
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <adminNavItem.icon className="h-5 w-5" />
                {adminNavItem.label}
              </Link>
            ) : null}
          </div>

          <div className="my-4 shrink-0 border-t border-sidebar-border" />

          <div className="space-y-1">
            {hasSession ? (
              <Link
                href={profileItem.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  pathname === profileItem.href
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <profileItem.icon className="h-5 w-5" />
                {profileItem.label}
              </Link>
            ) : (
              guestAuthItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))
            )}
          </div>

          <div className="my-4 shrink-0 border-t border-sidebar-border" />

          <div className="space-y-1">
            {utilityItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </aside>
    </>
  )
}
