"use client"

import { useTranslations } from "next-intl"
import { AlertCircle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"

type HealthProfileFieldsProps = {
  allergiesText: string
  onAllergiesTextChange: (value: string) => void
  noAllergies: boolean
  onNoAllergiesChange: (value: boolean) => void
  diseasesText: string
  onDiseasesTextChange: (value: string) => void
  noDiseases: boolean
  onNoDiseasesChange: (value: boolean) => void
  idPrefix: string
}

export function HealthProfileFields({
  allergiesText,
  onAllergiesTextChange,
  noAllergies,
  onNoAllergiesChange,
  diseasesText,
  onDiseasesTextChange,
  noDiseases,
  onNoDiseasesChange,
  idPrefix,
}: HealthProfileFieldsProps) {
  const t = useTranslations("HealthProfile")
  const allergyCheckboxId = `${idPrefix}-no-allergies`
  const diseaseCheckboxId = `${idPrefix}-no-diseases`
  const allergyAreaId = `${idPrefix}-allergies-text`
  const diseaseAreaId = `${idPrefix}-diseases-text`

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          <span className="font-medium text-foreground">{t("allergiesTitle")}</span>
        </div>
        <Field>
          <FieldLabel htmlFor={allergyAreaId}>{t("allergiesLabel")}</FieldLabel>
          <Textarea
            id={allergyAreaId}
            placeholder={t("allergiesPh")}
            rows={4}
            value={allergiesText}
            disabled={noAllergies}
            onChange={(e) => {
              const v = e.target.value
              onAllergiesTextChange(v)
              if (v.trim()) onNoAllergiesChange(false)
            }}
            className="min-h-[100px] resize-y"
          />
        </Field>
        <div className="flex items-center gap-2">
          <Checkbox
            id={allergyCheckboxId}
            checked={noAllergies}
            onCheckedChange={(checked) => {
              const on = checked === true
              onNoAllergiesChange(on)
              if (on) onAllergiesTextChange("")
            }}
          />
          <label
            htmlFor={allergyCheckboxId}
            className="text-sm leading-snug text-muted-foreground"
          >
            {t("noAllergies")}
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
          <span className="font-medium text-foreground">{t("diseasesTitle")}</span>
        </div>
        <Field>
          <FieldLabel htmlFor={diseaseAreaId}>{t("diseasesLabel")}</FieldLabel>
          <Textarea
            id={diseaseAreaId}
            placeholder={t("diseasesPh")}
            rows={4}
            value={diseasesText}
            disabled={noDiseases}
            onChange={(e) => {
              const v = e.target.value
              onDiseasesTextChange(v)
              if (v.trim()) onNoDiseasesChange(false)
            }}
            className="min-h-[100px] resize-y"
          />
        </Field>
        <div className="flex items-center gap-2">
          <Checkbox
            id={diseaseCheckboxId}
            checked={noDiseases}
            onCheckedChange={(checked) => {
              const on = checked === true
              onNoDiseasesChange(on)
              if (on) onDiseasesTextChange("")
            }}
          />
          <label
            htmlFor={diseaseCheckboxId}
            className="text-sm leading-snug text-muted-foreground"
          >
            {t("noDiseases")}
          </label>
        </div>
      </div>
    </>
  )
}
