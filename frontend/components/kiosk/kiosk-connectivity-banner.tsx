"use client"

import type { KioskMessages } from "@/lib/kiosk-i18n"
import {
  getKioskS3BaseUrl,
  isKioskCloudRelayMode,
} from "@/lib/kiosk-connectivity"

type Props = {
  t: KioskMessages
  mixedContent: boolean
  connected: boolean
}

export function KioskConnectivityBanner({
  t,
  mixedContent,
  connected,
}: Props) {
  if (mixedContent) {
    return (
      <div
        role="alert"
        className="border-b border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        <p className="font-semibold">{t.mixedContentTitle}</p>
        <p className="mt-1 text-destructive/90">{t.mixedContentBody}</p>
      </div>
    )
  }

  if (!connected) {
    const cloud = isKioskCloudRelayMode()
    return (
      <div
        role="alert"
        className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
      >
        <p className="font-semibold">{t.s3OfflineTitle}</p>
        <p className="mt-1">
          {cloud ? t.kioskOfflineCloudBody : t.s3OfflineBody}
          {!cloud ? ` (${getKioskS3BaseUrl()})` : null}
        </p>
      </div>
    )
  }

  return null
}
