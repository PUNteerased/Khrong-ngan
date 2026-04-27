"use client"

import { useEffect, useState } from "react"
import { Link, useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useForm, Controller } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ChevronRight,
  User,
  ClipboardPlus,
  Activity,
  Shield,
  Pill,
  Settings,
  LogOut,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ImageUploader } from "@/components/image-uploader"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldLabel } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { formatThaiMobileInput } from "@/lib/phone-format"
import {
  fetchMe,
  patchMe,
  deleteMe,
  requestMyPhoneOtp,
  verifyMyPhoneOtp,
  changeMyPassword,
  ApiError,
} from "@/lib/api"
import { getStoredToken, setStoredToken } from "@/lib/auth-token"

const ALLERGY_CHIPS = ["Paracetamol", "NSAIDs", "Penicillin"] as const

const profileSchema = z.object({
  fullName: z.string().trim().min(1, "fullNameRequired"),
  age: z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => (v === "" || v == null ? null : Number(v))),
  weight: z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => (v === "" || v == null ? null : Number(v))),
  height: z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => (v === "" || v == null ? null : Number(v))),
  gender: z.union([z.literal("male"), z.literal("female"), z.literal("other"), z.literal("")]),
  allergiesText: z.string(),
  noAllergies: z.boolean(),
  diseasesText: z.string(),
  noDiseases: z.boolean(),
  currentMedications: z.string(),
  noMedications: z.boolean(),
})

type ProfileFormValues = z.input<typeof profileSchema>

function splitCsv(v: string): string[] {
  return v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
}

export default function ProfilePage() {
  const router = useRouter()
  const t = useTranslations("Profile")
  const tHealth = useTranslations("HealthProfile")
  const tNav = useTranslations("Nav")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [phoneInput, setPhoneInput] = useState("")
  const [phone, setPhone] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false)
  const [verifyingPhoneOtp, setVerifyingPhoneOtp] = useState(false)
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [phoneOtpCode, setPhoneOtpCode] = useState("")
  const [phoneVerifyToken, setPhoneVerifyToken] = useState("")
  const [pwdCurrent, setPwdCurrent] = useState("")
  const [pwdNext, setPwdNext] = useState("")
  const [pwdConfirm, setPwdConfirm] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: "",
      age: "",
      weight: "",
      height: "",
      gender: "",
      allergiesText: "",
      noAllergies: false,
      diseasesText: "",
      noDiseases: false,
      currentMedications: "",
      noMedications: false,
    },
  })

  useEffect(() => {
    if (!getStoredToken()) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const u = await fetchMe()
        if (cancelled) return
        setUsername(u.username)
        setEmail(u.email ?? "")
        setPhone(u.phone)
        setPhoneInput(formatThaiMobileInput(u.phone ?? ""))
        setAvatarUrl(u.avatarUrl ?? null)
        setIsAdmin(!!u.isAdmin)
        form.reset({
          fullName: u.fullName,
          age: u.age != null ? String(u.age) : "",
          weight: u.weight != null ? String(u.weight) : "",
          height: u.height != null ? String(u.height) : "",
          gender: (u.gender as ProfileFormValues["gender"]) ?? "",
          allergiesText: u.allergiesText,
          noAllergies: u.noAllergies,
          diseasesText: u.diseasesText,
          noDiseases: u.noDiseases,
          currentMedications: u.currentMedications ?? "",
          noMedications:
            (u.currentMedications ?? "").trim() === "" ||
            (u.currentMedications ?? "").trim() === "ไม่มี",
        })
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setStoredToken(null)
          router.push("/login")
        } else {
          toast.error(err instanceof Error ? err.message : t("loadFail"))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [form, router, t])

  const toggleAllergyChip = (chip: string) => {
    const noAllergies = form.getValues("noAllergies")
    if (noAllergies) form.setValue("noAllergies", false)
    const current = splitCsv(form.getValues("allergiesText"))
    const has = current.some((x) => x.toLowerCase() === chip.toLowerCase())
    const next = has
      ? current.filter((x) => x.toLowerCase() !== chip.toLowerCase())
      : [...current, chip]
    form.setValue("allergiesText", next.join(", "), { shouldDirty: true })
  }

  const handleSave = form.handleSubmit(async (values) => {
    setSaving(true)
    try {
      const phoneDigits = phoneInput.replace(/\D/g, "")
      const phoneChanged = phoneDigits !== (phone || "")
      if (phoneChanged) {
        if (phoneDigits.length !== 10) {
          toast.error("เบอร์โทรต้องเป็นตัวเลข 10 หลัก")
          return
        }
        if (!phoneVerifyToken) {
          toast.error("กรุณายืนยัน OTP เบอร์โทรก่อนบันทึก")
          return
        }
      }
      await patchMe({
        fullName: values.fullName.trim(),
        email: (email ?? "").trim().toLowerCase(),
        phone: phoneDigits,
        phoneVerifyToken: phoneChanged ? phoneVerifyToken : undefined,
        age: values.age == null ? null : Number(values.age),
        weight: values.weight == null ? null : Number(values.weight),
        height: values.height == null ? null : Number(values.height),
        gender: String(values.gender ?? "").trim() === "" ? null : String(values.gender),
        allergiesText: values.allergiesText,
        noAllergies: values.noAllergies,
        diseasesText: values.diseasesText,
        noDiseases: values.noDiseases,
        currentMedications: values.noMedications ? "ไม่มี" : values.currentMedications,
      })
      toast.success(t("saveOk"))
      if (phoneChanged) {
        setPhone(phoneDigits)
        setPhoneOtpSent(false)
        setPhoneOtpCode("")
        setPhoneVerifyToken("")
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("saveFail")
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  })

  const handleAvatarChange = async (url: string | null) => {
    setAvatarUrl(url)
    try {
      await patchMe({ avatarUrl: url })
      toast.success(t("avatarSaved"))
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("saveFail")
      toast.error(msg)
    }
  }

  const sendPhoneOtp = async () => {
    const phoneDigits = phoneInput.replace(/\D/g, "")
    if (phoneDigits.length !== 10) {
      toast.error("เบอร์โทรต้องเป็นตัวเลข 10 หลัก")
      return
    }
    setSendingPhoneOtp(true)
    try {
      const res = await requestMyPhoneOtp(phoneDigits)
      setPhoneOtpSent(true)
      setPhoneVerifyToken("")
      toast.success(res.message)
      if (res.devCode) toast.info(`โค้ดทดสอบ: ${res.devCode}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่ง OTP ไม่สำเร็จ")
    } finally {
      setSendingPhoneOtp(false)
    }
  }

  const verifyPhone = async () => {
    const phoneDigits = phoneInput.replace(/\D/g, "")
    if (phoneDigits.length !== 10 || phoneOtpCode.length !== 6) {
      toast.error("กรุณากรอก OTP 6 หลักให้ถูกต้อง")
      return
    }
    setVerifyingPhoneOtp(true)
    try {
      const res = await verifyMyPhoneOtp(phoneDigits, phoneOtpCode)
      setPhoneVerifyToken(res.verifyToken)
      toast.success("ยืนยัน OTP สำเร็จ")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ยืนยัน OTP ไม่สำเร็จ")
    } finally {
      setVerifyingPhoneOtp(false)
    }
  }

  const handleChangePassword = async () => {
    if (!pwdCurrent || !pwdNext) {
      toast.error("กรุณากรอกรหัสผ่านให้ครบ")
      return
    }
    if (pwdNext.length < 6) {
      toast.error("รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร")
      return
    }
    if (pwdNext !== pwdConfirm) {
      toast.error("รหัสผ่านใหม่ไม่ตรงกัน")
      return
    }
    setChangingPassword(true)
    try {
      const res = await changeMyPassword(pwdCurrent, pwdNext)
      toast.success(res.message)
      setPwdCurrent("")
      setPwdNext("")
      setPwdConfirm("")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ")
    } finally {
      setChangingPassword(false)
    }
  }

  const handleLogout = () => {
    setStoredToken(null)
    toast.success(t("logoutOk"))
    router.push("/login")
    router.refresh()
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      await deleteMe()
      setStoredToken(null)
      toast.success(t("deleteOk"))
      router.push("/login")
      router.refresh()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("deleteFail")
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-10 w-40" />
      </div>
    )
  }

  if (!getStoredToken()) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12 text-center space-y-4">
        <p className="text-muted-foreground">{t("needLogin")}</p>
        <Button asChild>
          <Link href="/login">{t("login")}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-background pb-8">
      <div className="mx-auto w-full max-w-4xl px-2 py-6 sm:px-4 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              {t("title")}
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              {t("subtitle")}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3">
              <ImageUploader
                folder="avatars"
                shape="circle"
                value={avatarUrl}
                onChange={(url) => void handleAvatarChange(url)}
                disabled={saving}
                label={t("avatarLabel")}
                size={96}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="min-w-0 flex-1 space-y-2 pr-2">
                <div className="flex items-center gap-2">
                  <ClipboardPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm font-medium">{username ? `@${username}` : "—"}</p>
                </div>
                {phone ? (
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {formatThaiMobileInput(phone)}
                  </p>
                ) : null}
                {email ? (
                  <p className="text-sm text-muted-foreground">
                    {email}
                  </p>
                ) : null}
              </div>
            </div>

            <Separator />
            <div className="rounded-lg border bg-background p-4 space-y-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <User className="h-4 w-4" />
                  {t("stepPersonal")}
                </div>
                <Field>
                  <FieldLabel>{t("fullNameLabel")}</FieldLabel>
                  <Input
                    {...form.register("fullName")}
                    placeholder={t("fullNamePh")}
                    className="h-10"
                  />
                </Field>
                <Field>
                  <FieldLabel>อีเมล</FieldLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </Field>
                <Field>
                  <FieldLabel>เบอร์โทร (ต้องยืนยัน OTP เมื่อแก้ไข)</FieldLabel>
                  <Input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => {
                      setPhoneInput(formatThaiMobileInput(e.target.value))
                      setPhoneOtpSent(false)
                      setPhoneOtpCode("")
                      setPhoneVerifyToken("")
                    }}
                    placeholder="081-234-5678"
                    className="tabular-nums"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void sendPhoneOtp()}
                      disabled={sendingPhoneOtp}
                    >
                      {sendingPhoneOtp ? "กำลังส่ง OTP…" : "ส่ง OTP"}
                    </Button>
                    {phoneVerifyToken ? (
                      <span className="text-xs text-green-600">ยืนยัน OTP แล้ว</span>
                    ) : null}
                  </div>
                  {phoneOtpSent ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Input
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="กรอกรหัส OTP 6 หลัก"
                        value={phoneOtpCode}
                        onChange={(e) =>
                          setPhoneOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void verifyPhone()}
                        disabled={verifyingPhoneOtp}
                      >
                        {verifyingPhoneOtp ? "กำลังยืนยัน…" : "ยืนยัน OTP"}
                      </Button>
                    </div>
                  ) : null}
                </Field>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Activity className="h-4 w-4" />
                  {t("stepPhysical")}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel>{t("ageLabel")}</FieldLabel>
                    <Input type="number" placeholder="25" {...form.register("age")} />
                  </Field>
                  <Field>
                    <FieldLabel>{t("weightLabel")}</FieldLabel>
                    <Input type="number" placeholder="70" {...form.register("weight")} />
                  </Field>
                  <Field>
                    <FieldLabel>{t("heightLabel")}</FieldLabel>
                    <Input type="number" placeholder="170" {...form.register("height")} />
                  </Field>
                  <Field>
                    <FieldLabel>{tHealth("genderLabel")}</FieldLabel>
                    <Controller
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <Select
                          value={field.value || undefined}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={tHealth("genderPh")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">{tHealth("genderMale")}</SelectItem>
                            <SelectItem value="female">{tHealth("genderFemale")}</SelectItem>
                            <SelectItem value="other">{tHealth("genderOther")}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                </div>
              </div>

              <Separator />

              <div className="space-y-5">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Pill className="h-4 w-4" />
                  {t("stepMedical")}
                </div>

                <div className="space-y-3">
                  <Field>
                    <FieldLabel>{tHealth("allergiesLabel")}</FieldLabel>
                    <div className="mb-2 flex flex-wrap gap-2">
                      {ALLERGY_CHIPS.map((chip) => {
                        const selected = splitCsv(form.watch("allergiesText")).some(
                          (x) => x.toLowerCase() === chip.toLowerCase()
                        )
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => toggleAllergyChip(chip)}
                            className={`rounded-full border px-3 py-1 text-xs transition ${
                              selected
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-background text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {chip}
                          </button>
                        )
                      })}
                    </div>
                    <Textarea
                      rows={3}
                      placeholder={tHealth("allergiesPh")}
                      disabled={form.watch("noAllergies")}
                      {...form.register("allergiesText")}
                    />
                  </Field>
                  <Controller
                    control={form.control}
                    name="noAllergies"
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="profile-no-allergies"
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            const on = checked === true
                            field.onChange(on)
                            if (on) form.setValue("allergiesText", "")
                          }}
                        />
                        <label
                          htmlFor="profile-no-allergies"
                          className="text-sm text-muted-foreground"
                        >
                          {tHealth("noAllergies")}
                        </label>
                      </div>
                    )}
                  />
                </div>

                <div className="space-y-3">
                  <Field>
                    <FieldLabel>{tHealth("diseasesLabel")}</FieldLabel>
                    <Textarea
                      rows={3}
                      placeholder={tHealth("diseasesPh")}
                      disabled={form.watch("noDiseases")}
                      {...form.register("diseasesText")}
                    />
                  </Field>
                  <Controller
                    control={form.control}
                    name="noDiseases"
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="profile-no-diseases"
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            const on = checked === true
                            field.onChange(on)
                            if (on) form.setValue("diseasesText", "")
                          }}
                        />
                        <label
                          htmlFor="profile-no-diseases"
                          className="text-sm text-muted-foreground"
                        >
                          {tHealth("noDiseases")}
                        </label>
                      </div>
                    )}
                  />
                </div>

                <div className="space-y-3">
                  <Field>
                    <FieldLabel>{tHealth("medicationsLabel")}</FieldLabel>
                    <Textarea
                      rows={3}
                      placeholder={tHealth("medicationsPh")}
                      disabled={form.watch("noMedications")}
                      {...form.register("currentMedications")}
                    />
                  </Field>
                  <Controller
                    control={form.control}
                    name="noMedications"
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="profile-no-medications"
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            const on = checked === true
                            field.onChange(on)
                            if (on) form.setValue("currentMedications", "")
                          }}
                        />
                        <label
                          htmlFor="profile-no-medications"
                          className="text-sm text-muted-foreground"
                        >
                          {tHealth("noMedications")}
                        </label>
                      </div>
                    )}
                  />
                </div>
              </div>

              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? t("saving") : t("saveProfile")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t("accountTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-lg border bg-background p-4 space-y-3">
              <p className="text-sm font-medium">เปลี่ยนรหัสผ่าน</p>
              <Input
                type="password"
                placeholder="รหัสผ่านปัจจุบัน"
                value={pwdCurrent}
                onChange={(e) => setPwdCurrent(e.target.value)}
              />
              <Input
                type="password"
                placeholder="รหัสผ่านใหม่"
                value={pwdNext}
                onChange={(e) => setPwdNext(e.target.value)}
              />
              <Input
                type="password"
                placeholder="ยืนยันรหัสผ่านใหม่"
                value={pwdConfirm}
                onChange={(e) => setPwdConfirm(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleChangePassword()}
                disabled={changingPassword}
              >
                {changingPassword ? "กำลังเปลี่ยนรหัสผ่าน…" : "เปลี่ยนรหัสผ่าน"}
              </Button>
            </div>
            {isAdmin ? (
              <Button asChild variant="outline" className="w-full justify-start gap-3" size="lg">
                <Link href="/admin">
                  <Shield className="h-5 w-5" />
                  {tNav("admin")}
                </Link>
              </Button>
            ) : null}
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              size="lg"
              type="button"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
              {t("logout")}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                  size="lg"
                >
                  <Trash2 className="h-5 w-5" />
                  {t("deleteUser")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("dialogDeleteTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("dialogDeleteBody")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("deleteCancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => void handleDeleteAccount()}
                    disabled={deleting}
                  >
                    {t("deleteConfirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <Link
          href="/settings"
          className="flex items-center justify-between p-4 rounded-xl border bg-card text-card-foreground shadow-sm hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{t("appSettings")}</p>
              <p className="text-sm text-muted-foreground">
                {t("appSettingsDesc")}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </Link>
      </div>
    </div>
  )
}
