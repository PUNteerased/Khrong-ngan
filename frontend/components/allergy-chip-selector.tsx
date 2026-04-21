"use client"

import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

interface AllergyChipSelectorProps {
  selectedAllergies: string[]
  onToggle: (allergy: string) => void
  disabled?: boolean
}

const COMMON_ALLERGIES = [
  { id: "paracetamol", thKey: "paracetamol" },
  { id: "nsaids", thKey: "nsaids" },
  { id: "penicillin", thKey: "penicillin" },
  { id: "sulfa", thKey: "sulfa" },
  { id: "aspirin", thKey: "aspirin" },
  { id: "ibuprofen", thKey: "ibuprofen" },
] as const

export function AllergyChipSelector({
  selectedAllergies,
  onToggle,
  disabled,
}: AllergyChipSelectorProps) {
  const t = useTranslations("AllergyChips")

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <div className="flex flex-wrap gap-2">
        {COMMON_ALLERGIES.map((allergy) => {
          const isSelected = selectedAllergies.includes(allergy.id)
          return (
            <button
              key={allergy.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(allergy.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all",
                "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-border bg-muted/50 text-muted-foreground hover:border-destructive/50 hover:bg-destructive/5",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {isSelected && <Check className="h-3.5 w-3.5" />}
              {t(allergy.thKey)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
