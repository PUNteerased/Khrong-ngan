"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Phone,
  AlertTriangle,
  Send,
  MapPin,
  Mail,
  Users,
  Upload,
  Bot,
  Bug,
  Lightbulb,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ApiError, fetchMe, submitIssueReport } from "@/lib/api"
import { getStoredToken } from "@/lib/auth-token"
import {
  ISSUE_SUB_CATEGORIES,
  type IssueMainCategory,
} from "@/lib/issue-categories"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"])

export default function ContactPage() {
  const t = useTranslations("Contact")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    category: "" as IssueMainCategory | "",
    subCategory: "",
    subCategoryOther: "",
    description: "",
    email: "",
  })
  const [pendingImage, setPendingImage] = useState<{
    file: File
    previewUrl: string
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const issueCategories = useMemo(
    () => [
      { value: "medical_logic" as const, label: t("catMedicalLogic"), icon: Bot },
      { value: "technical_bug" as const, label: t("catTechnicalBug"), icon: Bug },
      { value: "feedback" as const, label: t("catFeedback"), icon: Lightbulb },
    ],
    [t]
  )

  const subOptions = useMemo(() => {
    if (!formData.category) return []
    return ISSUE_SUB_CATEGORIES[formData.category].map((item) => ({
      value: item.value,
      label: t(item.labelKey),
    }))
  }, [formData.category, t])

  useEffect(() => {
    if (!getStoredToken()) return
    void fetchMe()
      .then((me) => {
        if (me.email) {
          setFormData((prev) =>
            prev.email ? prev : { ...prev, email: me.email ?? "" }
          )
        }
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    return () => {
      if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl)
    }
  }, [pendingImage])

  const clearPendingImage = () => {
    if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl)
    setPendingImage(null)
  }

  const handleFileSelected = (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) {
      toast.error(t("imageInvalid"))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("imageTooLarge"))
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setPendingImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return { file, previewUrl }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.category) {
      toast.error(t("categoryRequired"))
      return
    }
    if (!formData.subCategory) {
      toast.error(t("subCategoryRequired"))
      return
    }
    if (formData.subCategory === "other" && !formData.subCategoryOther.trim()) {
      toast.error(t("subOtherRequired"))
      return
    }
    if (!formData.description.trim()) {
      toast.error(t("detailsRequired"))
      return
    }
    const email = formData.email.trim()
    if (!email) {
      toast.error(t("emailRequired"))
      return
    }
    if (!EMAIL_RE.test(email)) {
      toast.error(t("emailInvalid"))
      return
    }

    setIsSubmitting(true)
    try {
      const result = await submitIssueReport({
        category: formData.category,
        subCategory: formData.subCategory,
        subCategoryOther: formData.subCategoryOther,
        description: formData.description.trim(),
        email,
        imageFile: pendingImage?.file ?? null,
      })
      toast.success(t("submitSuccess"))
      if (result.warning) toast.warning(result.warning)
      setFormData({
        category: "",
        subCategory: "",
        subCategoryOther: "",
        description: "",
        email,
      })
      clearPendingImage()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("submitFail")
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-background pb-8">
      <div className="mx-auto w-full max-w-4xl px-2 py-6 sm:px-4 space-y-6">
        <a href="tel:1669">
          <Card className="bg-destructive/10 border-destructive/30 hover:bg-destructive/20 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-destructive/20">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">
                    {t("emergencyTitle")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("emergencyLine")}
                  </p>
                </div>
                <Phone className="h-6 w-6 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </a>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              {t("formTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
              <FieldGroup>
                <Field>
                  <FieldLabel>{t("category")} *</FieldLabel>
                  <RadioGroup
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        category: value as IssueMainCategory,
                        subCategory: "",
                        subCategoryOther: "",
                      })
                    }
                    className="gap-3"
                  >
                    {issueCategories.map((cat) => (
                      <div key={cat.value} className="space-y-2">
                        <label
                          htmlFor={`issue-${cat.value}`}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                        >
                          <RadioGroupItem
                            id={`issue-${cat.value}`}
                            value={cat.value}
                            className="mt-0.5"
                          />
                          <div className="flex items-start gap-2">
                            <cat.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="text-sm leading-snug">{cat.label}</span>
                          </div>
                        </label>

                        {formData.category === cat.value ? (
                          <div className="ml-7 space-y-2 border-l-2 border-primary/20 pl-4">
                            <Field>
                              <FieldLabel className="text-xs text-muted-foreground">
                                {t("subCategory")} *
                              </FieldLabel>
                              <Select
                                key={`${cat.value}-sub`}
                                value={formData.subCategory}
                                onValueChange={(value) =>
                                  setFormData({
                                    ...formData,
                                    subCategory: value,
                                    subCategoryOther:
                                      value === "other"
                                        ? formData.subCategoryOther
                                        : "",
                                  })
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder={t("subCategoryPh")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {subOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>

                            {formData.subCategory === "other" ? (
                              <Field>
                                <Input
                                  placeholder={t("subOtherPh")}
                                  value={formData.subCategoryOther}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      subCategoryOther: e.target.value,
                                    })
                                  }
                                  maxLength={120}
                                />
                              </Field>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </RadioGroup>
                </Field>

                <Field>
                  <FieldLabel>{t("details")} *</FieldLabel>
                  <Textarea
                    placeholder={t("detailsPh")}
                    rows={5}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel>{t("contactEmail")} *</FieldLabel>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      className="pl-9"
                      placeholder={t("contactEmailPh")}
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      autoComplete="email"
                    />
                  </div>
                </Field>
              </FieldGroup>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (file) handleFileSelected(file)
                }}
              />

              {pendingImage ? (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pendingImage.previewUrl}
                    alt="preview"
                    className="h-14 w-14 rounded object-cover"
                  />
                  <p className="flex-1 text-xs text-muted-foreground">
                    {t("imageAttached")}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={clearPendingImage}
                    className="text-destructive hover:text-destructive"
                  >
                    {t("imageRemove")}
                  </Button>
                </div>
              ) : null}

              <div className="space-y-1">
                <Button
                  variant="outline"
                  type="button"
                  className="w-full"
                  disabled={isSubmitting}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {t("attachPhoto")}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {t("attachPhotoHint")}
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Spinner className="h-4 w-4 mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {isSubmitting ? t("submitting") : t("submitReport")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t("devTeamTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{t("locationTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("locationBody")}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{t("adminEmailTitle")}</p>
                <a
                  href="mailto:29152@ud.ac.th"
                  className="text-sm text-primary hover:underline"
                >
                  29152@ud.ac.th
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{t("teamTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("teamBody")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
