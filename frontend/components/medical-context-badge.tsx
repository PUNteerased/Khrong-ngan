"use client"

import { useTranslations } from "next-intl"
import { Stethoscope, User, Scale, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface MedicalContextBadgeProps {
  age?: number | null
  weight?: number | null
  allergies?: string
  className?: string
}

export function MedicalContextBadge({
  age,
  weight,
  allergies,
  className,
}: MedicalContextBadgeProps) {
  const t = useTranslations("Chat")

  const hasData = age != null || weight != null || allergies

  if (!hasData) return null

  return (
    <div
      className={cn(
        "flex items-center gap-2 overflow-x-auto rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs",
        className
      )}
    >
      <Stethoscope className="h-4 w-4 shrink-0 text-primary" />
      <div className="flex items-center gap-3 text-foreground whitespace-nowrap">
        {age != null && (
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              <span className="text-muted-foreground">{t("badgeAge")}:</span>{" "}
              <span className="font-medium">{age}</span>
            </span>
          </div>
        )}
        {weight != null && (
          <div className="flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              <span className="text-muted-foreground">{t("badgeWeight")}:</span>{" "}
              <span className="font-medium">{weight} kg</span>
            </span>
          </div>
        )}
        {allergies && (
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            <span>
              <span className="text-destructive">{t("badgeAllergy")}:</span>{" "}
              <span className="font-medium text-destructive/80">{allergies}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
