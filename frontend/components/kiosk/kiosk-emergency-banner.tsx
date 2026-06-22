import type { KioskMessages } from "@/lib/kiosk-i18n"

type Props = { t: KioskMessages }

export function KioskEmergencyBanner({ t }: Props) {
  return (
    <div
      className="flex min-h-[7vh] shrink-0 items-center bg-destructive px-4 py-2 text-destructive-foreground animate-pulse"
      role="alert"
    >
      <p className="text-center text-[clamp(0.85rem,2.2vw,1.05rem)] font-semibold leading-snug">
        {t.emergencyBanner}
      </p>
    </div>
  )
}
