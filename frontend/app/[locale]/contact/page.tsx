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
  Box,
  QrCode,
  Bot,
  Lightbulb,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ApiError, submitIssueReport } from "@/lib/api"
import { uploadImage } from "@/lib/upload-image"
import { isSupabaseConfigured } from "@/lib/supabase"

export default function ContactPage() {
  const t = useTranslations("Contact")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    category: "",
    description: "",
  })
  const [pendingImage, setPendingImage] = useState<{
    url: string
    previewUrl: string
  } | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const issueCategories = useMemo(
    () => [
      { value: "dispenser", label: t("catDispenser"), icon: Box },
      { value: "qr", label: t("catQr"), icon: QrCode },
      { value: "ai", label: t("catAi"), icon: Bot },
      { value: "other", label: t("catOther"), icon: Lightbulb },
    ],
    [t]
  )

  useEffect(() => {
    return () => {
      if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl)
    }
  }, [pendingImage])

  const clearPendingImage = () => {
    if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl)
    setPendingImage(null)
  }

  const handleFileSelected = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("imageInvalid"))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("imageTooLarge"))
      return
    }
    if (!isSupabaseConfigured()) {
      toast.error(t("imageNotConfigured"))
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setIsUploading(true)
    try {
      const { url } = await uploadImage(file, "reports")
      setPendingImage((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
        return { url, previewUrl }
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("imageUploadFail")
      toast.error(msg)
      URL.revokeObjectURL(previewUrl)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.category) {
      toast.error(t("categoryRequired"))
      return
    }
    if (!formData.description.trim()) {
      toast.error(t("detailsRequired"))
      return
    }

    setIsSubmitting(true)
    try {
      await submitIssueReport({
        category: formData.category,
        description: formData.description.trim(),
        imageUrl: pendingImage?.url ?? null,
      })
      toast.success(t("submitSuccess"))
      setFormData({ category: "", description: "" })
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
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>{t("category")}</FieldLabel>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("categoryPh")} />
                    </SelectTrigger>
                    <SelectContent>
                      {issueCategories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <cat.icon className="h-4 w-4" />
                            {cat.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>{t("details")}</FieldLabel>
                  <Textarea
                    placeholder={t("detailsPh")}
                    rows={4}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </Field>
              </FieldGroup>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (file) void handleFileSelected(file)
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

              <Button
                variant="outline"
                type="button"
                className="w-full"
                disabled={isUploading || isSubmitting}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <Spinner className="h-4 w-4 mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {t("attachPhoto")}
              </Button>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting || isUploading}
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
