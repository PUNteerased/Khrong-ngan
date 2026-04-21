"use client"

import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { z } from "zod"
import { User, Scale, AlertCircle, ChevronLeft, ChevronRight, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AllergyChipSelector } from "@/components/allergy-chip-selector"
import { cn } from "@/lib/utils"

// Zod schemas for validation
const personalInfoSchema = z.object({
  fullName: z.string().min(1, "Required"),
  age: z.number().min(1).max(150).nullable(),
  weight: z.number().min(1).max(500).nullable(),
  height: z.number().min(30).max(300).nullable(),
  gender: z.string().nullable(),
})

const medicalHistorySchema = z.object({
  allergiesText: z.string(),
  noAllergies: z.boolean(),
  diseasesText: z.string(),
  noDiseases: z.boolean(),
  currentMedications: z.string(),
  noMedications: z.boolean(),
})

export type ProfileFormData = z.infer<typeof personalInfoSchema> &
  z.infer<typeof medicalHistorySchema>

interface MultiStepProfileFormProps {
  initialData: ProfileFormData
  onSave: (data: ProfileFormData) => Promise<void>
  saving?: boolean
}

const STEPS = ["personal", "body", "medical"] as const
type Step = (typeof STEPS)[number]

const ALLERGY_MAP: Record<string, string> = {
  paracetamol: "พาราเซตามอล, Paracetamol, Acetaminophen",
  nsaids: "NSAIDs, ไอบูโพรเฟน, ไดโคลฟีแนค",
  penicillin: "เพนิซิลลิน, Penicillin, อะม็อกซีซิลลิน",
  sulfa: "ซัลฟา, Sulfa, Sulfamethoxazole",
  aspirin: "แอสไพริน, Aspirin",
  ibuprofen: "ไอบูโพรเฟน, Ibuprofen",
}

export function MultiStepProfileForm({
  initialData,
  onSave,
  saving,
}: MultiStepProfileFormProps) {
  const t = useTranslations("Profile")
  const tHealth = useTranslations("HealthProfile")

  const [currentStep, setCurrentStep] = useState<Step>("personal")
  const [formData, setFormData] = useState<ProfileFormData>(initialData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedAllergyChips, setSelectedAllergyChips] = useState<string[]>([])

  const currentStepIndex = STEPS.indexOf(currentStep)
  const progressPercent = ((currentStepIndex + 1) / STEPS.length) * 100

  const updateField = useCallback(
    <K extends keyof ProfileFormData>(key: K, value: ProfileFormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }))
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    []
  )

  const handleAllergyChipToggle = useCallback(
    (allergyId: string) => {
      setSelectedAllergyChips((prev) => {
        const next = prev.includes(allergyId)
          ? prev.filter((id) => id !== allergyId)
          : [...prev, allergyId]

        // Update allergiesText with selected chips
        const chipTexts = next.map((id) => ALLERGY_MAP[id] || id)
        const existingText = formData.allergiesText
          .split("\n")
          .filter((line) => {
            return !Object.values(ALLERGY_MAP).some((mapText) =>
              line.includes(mapText.split(",")[0])
            )
          })
          .join("\n")
          .trim()

        const newText = [existingText, ...chipTexts].filter(Boolean).join("\n")
        updateField("allergiesText", newText)
        if (newText) updateField("noAllergies", false)

        return next
      })
    },
    [formData.allergiesText, updateField]
  )

  const validateCurrentStep = (): boolean => {
    try {
      if (currentStep === "personal" || currentStep === "body") {
        personalInfoSchema.parse({
          fullName: formData.fullName,
          age: formData.age,
          weight: formData.weight,
          height: formData.height,
          gender: formData.gender,
        })
      }
      if (currentStep === "medical") {
        medicalHistorySchema.parse({
          allergiesText: formData.allergiesText,
          noAllergies: formData.noAllergies,
          diseasesText: formData.diseasesText,
          noDiseases: formData.noDiseases,
          currentMedications: formData.currentMedications,
          noMedications: formData.noMedications,
        })
      }
      return true
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {}
        err.errors.forEach((e) => {
          if (e.path[0]) newErrors[e.path[0] as string] = e.message
        })
        setErrors(newErrors)
      }
      return false
    }
  }

  const goNext = () => {
    if (!validateCurrentStep()) return
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex])
    }
  }

  const goBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex])
    }
  }

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return
    await onSave(formData)
  }

  const isLastStep = currentStepIndex === STEPS.length - 1

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("stepOf", { step: currentStepIndex + 1, total: STEPS.length })}
          </span>
          <span className="font-medium text-primary">
            {Math.round(progressPercent)}%
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />
        <div className="flex justify-between gap-2">
          {STEPS.map((step, index) => (
            <button
              key={step}
              type="button"
              onClick={() => {
                if (index < currentStepIndex) setCurrentStep(step)
              }}
              className={cn(
                "flex-1 rounded-lg border p-2 text-center text-xs font-medium transition-colors",
                index === currentStepIndex
                  ? "border-primary bg-primary/10 text-primary"
                  : index < currentStepIndex
                    ? "border-success bg-success/10 text-success cursor-pointer"
                    : "border-border bg-muted/50 text-muted-foreground"
              )}
            >
              {index < currentStepIndex && <Check className="inline-block h-3 w-3 mr-1" />}
              {step === "personal" && t("stepPersonal")}
              {step === "body" && t("stepBody")}
              {step === "medical" && t("stepMedical")}
            </button>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {currentStep === "personal" && (
              <>
                <User className="h-5 w-5" />
                {t("personalTitle")}
              </>
            )}
            {currentStep === "body" && (
              <>
                <Scale className="h-5 w-5" />
                {t("bodyTitle")}
              </>
            )}
            {currentStep === "medical" && (
              <>
                <AlertCircle className="h-5 w-5" />
                {t("medicalTitle")}
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Personal Info Step */}
          {currentStep === "personal" && (
            <>
              <Field>
                <FieldLabel htmlFor="profile-fullName">{t("fullNameLabel")}</FieldLabel>
                <Input
                  id="profile-fullName"
                  value={formData.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  placeholder={t("fullNamePh")}
                  className={errors.fullName ? "border-destructive" : ""}
                />
                {errors.fullName && (
                  <p className="text-xs text-destructive">{errors.fullName}</p>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-gender">{tHealth("genderLabel")}</FieldLabel>
                <Select
                  value={formData.gender || undefined}
                  onValueChange={(v) => updateField("gender", v)}
                >
                  <SelectTrigger id="profile-gender">
                    <SelectValue placeholder={tHealth("genderPh")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{tHealth("genderMale")}</SelectItem>
                    <SelectItem value="female">{tHealth("genderFemale")}</SelectItem>
                    <SelectItem value="other">{tHealth("genderOther")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {/* Body Measurements Step */}
          {currentStep === "body" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field>
                <FieldLabel htmlFor="profile-age">{t("ageLabel")}</FieldLabel>
                <Input
                  id="profile-age"
                  type="number"
                  inputMode="numeric"
                  value={formData.age ?? ""}
                  onChange={(e) =>
                    updateField("age", e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder="25"
                  min={1}
                  max={150}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-weight">{t("weightLabel")}</FieldLabel>
                <Input
                  id="profile-weight"
                  type="number"
                  inputMode="decimal"
                  value={formData.weight ?? ""}
                  onChange={(e) =>
                    updateField("weight", e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder="70"
                  min={1}
                  max={500}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-height">{t("heightLabel")}</FieldLabel>
                <Input
                  id="profile-height"
                  type="number"
                  inputMode="numeric"
                  value={formData.height ?? ""}
                  onChange={(e) =>
                    updateField("height", e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder="170"
                  min={30}
                  max={300}
                />
              </Field>
            </div>
          )}

          {/* Medical History Step */}
          {currentStep === "medical" && (
            <div className="space-y-6">
              {/* Allergies */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                  {tHealth("allergiesTitle")}
                </div>
                <AllergyChipSelector
                  selectedAllergies={selectedAllergyChips}
                  onToggle={handleAllergyChipToggle}
                  disabled={formData.noAllergies}
                />
                <Field>
                  <FieldLabel htmlFor="profile-allergies">
                    {tHealth("allergiesLabel")}
                  </FieldLabel>
                  <Textarea
                    id="profile-allergies"
                    placeholder={tHealth("allergiesPh")}
                    rows={3}
                    value={formData.allergiesText}
                    disabled={formData.noAllergies}
                    onChange={(e) => {
                      updateField("allergiesText", e.target.value)
                      if (e.target.value.trim()) updateField("noAllergies", false)
                    }}
                    className="min-h-[80px] resize-y"
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="profile-no-allergies"
                    checked={formData.noAllergies}
                    onCheckedChange={(checked) => {
                      const on = checked === true
                      updateField("noAllergies", on)
                      if (on) {
                        updateField("allergiesText", "")
                        setSelectedAllergyChips([])
                      }
                    }}
                  />
                  <label
                    htmlFor="profile-no-allergies"
                    className="text-sm text-muted-foreground"
                  >
                    {tHealth("noAllergies")}
                  </label>
                </div>
              </div>

              {/* Diseases */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
                  {tHealth("diseasesTitle")}
                </div>
                <Field>
                  <FieldLabel htmlFor="profile-diseases">
                    {tHealth("diseasesLabel")}
                  </FieldLabel>
                  <Textarea
                    id="profile-diseases"
                    placeholder={tHealth("diseasesPh")}
                    rows={3}
                    value={formData.diseasesText}
                    disabled={formData.noDiseases}
                    onChange={(e) => {
                      updateField("diseasesText", e.target.value)
                      if (e.target.value.trim()) updateField("noDiseases", false)
                    }}
                    className="min-h-[80px] resize-y"
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="profile-no-diseases"
                    checked={formData.noDiseases}
                    onCheckedChange={(checked) => {
                      const on = checked === true
                      updateField("noDiseases", on)
                      if (on) updateField("diseasesText", "")
                    }}
                  />
                  <label
                    htmlFor="profile-no-diseases"
                    className="text-sm text-muted-foreground"
                  >
                    {tHealth("noDiseases")}
                  </label>
                </div>
              </div>

              {/* Current Medications */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <AlertCircle className="h-4 w-4 shrink-0 text-primary" />
                  {tHealth("medicationsTitle")}
                </div>
                <Field>
                  <FieldLabel htmlFor="profile-medications">
                    {tHealth("medicationsLabel")}
                  </FieldLabel>
                  <Textarea
                    id="profile-medications"
                    placeholder={tHealth("medicationsPh")}
                    rows={3}
                    value={formData.currentMedications}
                    disabled={formData.noMedications}
                    onChange={(e) => {
                      updateField("currentMedications", e.target.value)
                      if (e.target.value.trim()) updateField("noMedications", false)
                    }}
                    className="min-h-[80px] resize-y"
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="profile-no-medications"
                    checked={formData.noMedications}
                    onCheckedChange={(checked) => {
                      const on = checked === true
                      updateField("noMedications", on)
                      if (on) updateField("currentMedications", "")
                    }}
                  />
                  <label
                    htmlFor="profile-no-medications"
                    className="text-sm text-muted-foreground"
                  >
                    {tHealth("noMedications")}
                  </label>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        {currentStepIndex > 0 && (
          <Button type="button" variant="outline" onClick={goBack} className="flex-1">
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t("back")}
          </Button>
        )}
        {isLastStep ? (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1"
          >
            {saving ? t("saving") : t("saveProfile")}
          </Button>
        ) : (
          <Button type="button" onClick={goNext} className="flex-1">
            {t("next")}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}
