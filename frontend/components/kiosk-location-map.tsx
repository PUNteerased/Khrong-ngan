"use client"

import { useEffect, useMemo, useState } from "react"
import { MapPin, Wifi, WifiOff } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { fetchKioskStatus, type KioskStatus } from "@/lib/api"
import {
  buildKioskMapEmbedUrl,
  buildKioskMapOpenUrl,
  DEFAULT_KIOSK_LAT,
  DEFAULT_KIOSK_LNG,
} from "@/lib/contact-location"

const POLL_MS = 60_000

export function KioskLocationMap() {
  const t = useTranslations("Contact")
  const locale = useLocale()
  const [status, setStatus] = useState<KioskStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const data = await fetchKioskStatus()
        if (!cancelled) setStatus(data)
      } catch {
        if (!cancelled) setStatus(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const timer = window.setInterval(() => void load(), POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const lat = status?.lat ?? DEFAULT_KIOSK_LAT
  const lng = status?.lng ?? DEFAULT_KIOSK_LNG
  const mapLang = locale === "en" ? "en" : "th"

  const embedUrl = useMemo(
    () => buildKioskMapEmbedUrl(lat, lng, mapLang),
    [lat, lng, mapLang]
  )
  const openUrl = useMemo(() => buildKioskMapOpenUrl(lat, lng), [lat, lng])

  const online = status?.online === true

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{t("locationTitle")}</p>
            {loading ? (
              <Badge variant="secondary">{t("kioskLoading")}</Badge>
            ) : online ? (
              <Badge className="gap-1 bg-success hover:bg-success/80">
                <Wifi className="h-3 w-3" />
                {t("kioskOnline")}
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="h-3 w-3" />
                {t("kioskOffline")}
              </Badge>
            )}
          </div>
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            {t("locationOpenMaps")}
          </a>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <iframe
          key={embedUrl}
          title={t("locationTitle")}
          src={embedUrl}
          className="h-56 w-full border-0 sm:h-64"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    </div>
  )
}
