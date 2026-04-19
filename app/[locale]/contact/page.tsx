"use client"

import { useState, useMemo } from "react"
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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function ContactPage() {
  const t = useTranslations("Contact")
  const [formData, setFormData] = useState({
    category: "",
    description: "",
  })

  const issueCategories = useMemo(
    () => [
      { value: "dispenser", label: t("catDispenser"), icon: Box },
      { value: "qr", label: t("catQr"), icon: QrCode },
      { value: "ai", label: t("catAi"), icon: Bot },
      { value: "other", label: t("catOther"), icon: Lightbulb },
    ],
    [t]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Contact form:", formData)
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-background pb-8">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
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
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <Button variant="outline" type="button" className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                {t("attachPhoto")}
              </Button>

              <Button type="submit" className="w-full" size="lg">
                <Send className="h-4 w-4 mr-2" />
                {t("submitReport")}
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
                <p className="text-sm text-muted-foreground">laneya@school.ac.th</p>
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
