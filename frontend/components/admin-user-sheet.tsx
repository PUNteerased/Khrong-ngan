"use client"

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  fetchAdminUser,
  patchAdminUser,
  type AdminUserRow,
  ApiError,
} from "@/lib/api"
import { toast } from "sonner"

type Props = {
  userId: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

export function AdminUserSheet({
  userId,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const t = useTranslations("Admin")
  const locale = useLocale()
  const [user, setUser] = useState<AdminUserRow | null>(null)
  const [med, setMed] = useState<
    {
      id: string
      createdAt: string
      pickupStatus: string
      recommendedDrug: { id: string; name: string; slotId: string } | null
    }[]
  >([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    age: "",
    weight: "",
    height: "",
    gender: "",
    allergiesText: "",
    noAllergies: false,
    diseasesText: "",
    noDiseases: false,
    currentMedications: "",
  })

  useEffect(() => {
    if (!open || !userId) {
      setUser(null)
      setMed([])
      return
    }
    let cancelled = false
    setLoading(true)
    fetchAdminUser(userId)
      .then((d) => {
        if (cancelled) return
        setUser(d.user)
        setMed(d.medicationHistory)
        setForm({
          fullName: d.user.fullName,
          email: d.user.email ?? "",
          phone: d.user.phone ?? "",
          age: d.user.age != null ? String(d.user.age) : "",
          weight: d.user.weight != null ? String(d.user.weight) : "",
          height: d.user.height != null ? String(d.user.height) : "",
          gender: d.user.gender ?? "",
          allergiesText: d.user.allergiesText,
          noAllergies: d.user.noAllergies,
          diseasesText: d.user.diseasesText,
          noDiseases: d.user.noDiseases,
          currentMedications: d.user.currentMedications ?? "",
        })
      })
      .catch((e) => {
        if (!cancelled)
          toast.error(e instanceof ApiError ? e.message : t("loadFail"))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, userId, t])

  const save = async () => {
    if (!userId) return
    setSaving(true)
    try {
      const u = await patchAdminUser(userId, {
        fullName: form.fullName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        age: form.age.trim() === "" ? null : parseInt(form.age, 10),
        weight: form.weight.trim() === "" ? null : parseFloat(form.weight),
        height: form.height.trim() === "" ? null : parseFloat(form.height),
        gender: form.gender.trim() || null,
        allergiesText: form.allergiesText,
        noAllergies: form.noAllergies,
        diseasesText: form.diseasesText,
        noDiseases: form.noDiseases,
        currentMedications: form.currentMedications,
      })
      setUser(u)
      toast.success(t("userSaved"))
      onSaved()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("loadFail"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="relative z-10 shrink-0 space-y-1 border-b bg-background px-6 pt-6 pb-4 pr-14 text-left">
          <SheetTitle className="pr-2">{t("usersTitle")}</SheetTitle>
          <SheetDescription className="sr-only">{t("usersTitle")}</SheetDescription>
          {!loading && user ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{t("usernameLoginId")}:</span>{" "}
              <span className="font-mono">{user.username}</span>
            </p>
          ) : null}
        </SheetHeader>

        <div className="relative z-0 min-h-0 flex-1 overflow-y-auto bg-background px-6 py-4">
          {loading || !user ? (
            <p className="text-sm text-muted-foreground py-4">{loading ? "…" : ""}</p>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="adm-u-name">{t("colUser")}</Label>
                <Input
                  id="adm-u-name"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("usernameLoginId")}</Label>
                  <Input value={user.username} disabled className="font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label>อีเมล</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adm-u-phone">{t("phoneLabel")}</Label>
                <Input
                  id="adm-u-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="adm-u-age">{t("ageShort")}</Label>
                  <Input
                    id="adm-u-age"
                    value={form.age}
                    onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adm-u-weight">{t("weightShort")}</Label>
                  <Input
                    id="adm-u-weight"
                    value={form.weight}
                    onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adm-u-height">ส่วนสูง (ซม.)</Label>
                  <Input
                    id="adm-u-height"
                    value={form.height}
                    onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adm-u-gender">เพศ</Label>
                  <Input
                    id="adm-u-gender"
                    value={form.gender}
                    onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                    placeholder="male / female / other"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="adm-u-na" className="text-sm leading-snug">
                    {t("noAllergiesToggle")}
                  </Label>
                  <Switch
                    id="adm-u-na"
                    checked={form.noAllergies}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, noAllergies: Boolean(v) }))
                    }
                  />
                </div>
                <Textarea
                  id="adm-u-allergies"
                  rows={2}
                  disabled={form.noAllergies}
                  value={form.allergiesText}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, allergiesText: e.target.value }))
                  }
                  className="bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adm-u-meds">{t("medHistoryTitle")}</Label>
                <Textarea
                  id="adm-u-meds"
                  rows={3}
                  value={form.currentMedications}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currentMedications: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground rounded-lg border bg-muted/20 p-3">
                <div>
                  <p className="font-medium text-foreground">สร้างเมื่อ</p>
                  <p>{new Date(user.createdAt).toLocaleString(locale === "en" ? "en-GB" : "th-TH")}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">อัปเดตล่าสุด</p>
                  <p>{new Date(user.updatedAt).toLocaleString(locale === "en" ? "en-GB" : "th-TH")}</p>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="adm-u-nd" className="text-sm leading-snug">
                    {t("noDiseasesToggle")}
                  </Label>
                  <Switch
                    id="adm-u-nd"
                    checked={form.noDiseases}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, noDiseases: Boolean(v) }))
                    }
                  />
                </div>
                <Textarea
                  id="adm-u-diseases"
                  rows={2}
                  disabled={form.noDiseases}
                  value={form.diseasesText}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, diseasesText: e.target.value }))
                  }
                  className="bg-background"
                />
              </div>

              <Button type="button" disabled={saving} onClick={() => void save()}>
                {saving ? "…" : t("saveUser")}
              </Button>

              <div className="space-y-2 pt-1">
                <p className="text-sm font-medium">{t("medHistoryTitle")}</p>
                <ScrollArea className="h-40 rounded-md border bg-muted/20">
                  <div className="p-2 space-y-2 text-xs">
                    {med.length === 0 ? (
                      <p className="text-muted-foreground px-1 py-2">—</p>
                    ) : (
                      med.map((m) => (
                        <div key={m.id} className="border-b border-border/60 pb-2 last:border-0">
                          <p className="text-muted-foreground">
                            {new Date(m.createdAt).toLocaleString(
                              locale === "en" ? "en-GB" : "th-TH"
                            )}
                          </p>
                          <p>
                            {m.recommendedDrug?.name ?? "—"} ({m.pickupStatus})
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
