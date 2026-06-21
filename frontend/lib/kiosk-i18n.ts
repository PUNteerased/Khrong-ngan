import { thMessages, enMessages } from "@/messages/catalog"
import type { KioskLocale } from "@/lib/kiosk-api"

export function getKioskMessages(locale: KioskLocale) {
  return locale === "en" ? enMessages.Kiosk : thMessages.Kiosk
}

export type KioskMessages = ReturnType<typeof getKioskMessages>
