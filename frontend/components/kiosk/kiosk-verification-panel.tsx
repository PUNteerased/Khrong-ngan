"use client"

import Image from "next/image"
import { Pill } from "lucide-react"
import type { KioskPreview } from "@/lib/kiosk-api"
import type { KioskMessages } from "@/lib/kiosk-i18n"

type Props = {
  t: KioskMessages
  preview: KioskPreview
}

export function KioskVerificationPanel({ t, preview }: Props) {
  const drug = preview.drug
  const summary =
    preview.sessionSummary?.trim() || drug.indication?.trim() || t.fallbackSummary
  const warnings = [drug.warnings, drug.contraindications].filter(Boolean).join("\n\n")

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-4 py-3">
      <section className="rounded-xl bg-secondary/60 p-4">
        <h2 className="mb-2 text-lg font-semibold text-primary">{t.analysisTitle}</h2>
        <p className="text-base leading-relaxed">{summary}</p>
      </section>

      <section className="flex flex-col items-center gap-3 rounded-xl bg-card p-4 shadow-sm">
        <div className="relative flex h-40 w-full max-w-xs items-center justify-center overflow-hidden rounded-xl bg-muted">
          {drug.imageUrl ? (
            <Image
              src={drug.imageUrl}
              alt={drug.name}
              fill
              className="object-contain p-2"
              unoptimized
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Pill className="h-16 w-16" />
              <span className="text-sm">{t.noDrugImage}</span>
            </div>
          )}
        </div>
        <div className="text-center">
          <p className="text-xl font-bold">{drug.name}</p>
          {(drug.genericName || drug.brandNameEn) && (
            <p className="text-muted-foreground">
              {[drug.genericName, drug.brandNameEn].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </section>

      {warnings ? (
        <section className="rounded-xl border-2 border-destructive bg-destructive/10 p-4">
          <h2 className="mb-2 text-lg font-semibold text-destructive">{t.warningsTitle}</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{warnings}</p>
        </section>
      ) : null}
    </div>
  )
}
