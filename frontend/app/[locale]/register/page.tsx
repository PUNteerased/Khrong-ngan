"use client"

import { useState, type FormEvent } from "react"
import { Link, useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  User,
  Phone,
  Eye,
  EyeOff,
  Scale,
  ChevronRight,
  ChevronLeft,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { HealthProfileFields } from "@/components/health-profile-fields"
import { Progress } from "@/components/ui/progress"
import { Pill } from "lucide-react"
import { registerUser, requestPhoneOtp, verifyPhoneOtp, ApiError } from "@/lib/api"
import { setStoredToken } from "@/lib/auth-token"
import { formatThaiMobileInput, phoneDigitsOnly } from "@/lib/phone-format"
import { normalizeUsername, USERNAME_PATTERN } from "@/lib/username"

export default function RegisterPage() {
  const router = useRouter()
  const t = useTranslations("Register")
  const tHealth = useTranslations("HealthProfile")
  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [otpVerified, setOtpVerified] = useState(false)
  const [phoneVerifyToken, setPhoneVerifyToken] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    phone: "",
    password: "",
    confirmPassword: "",
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
    consent: false,
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (step !== 2) return
    if (formData.password !== formData.confirmPassword) {
      toast.error(t("mismatch"))
      return
    }
    setLoading(true)
    try {
      const phoneDigits = phoneDigitsOnly(formData.phone)
      const { accessToken } = await registerUser({
        username: normalizeUsername(formData.username),
        phone: phoneDigits,
        phoneVerifyToken,
        password: formData.password,
        fullName: formData.name.trim(),
        age: formData.age ? Number(formData.age) : null,
        weight: formData.weight ? Number(formData.weight) : null,
        height: formData.height ? Number(formData.height) : null,
        gender: formData.gender ? formData.gender : null,
        allergiesText: formData.allergiesText,
        noAllergies: formData.noAllergies,
        diseasesText: formData.diseasesText,
        noDiseases: formData.noDiseases,
        currentMedications: formData.noMedications
          ? "ไม่มี"
          : formData.currentMedications,
      })
      setStoredToken(accessToken)
      toast.success(t("success"))
      router.push("/")
      router.refresh()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("fail")
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] px-4 py-6 bg-background">
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="flex flex-col items-center gap-2 pb-2">
          <span className="text-2xl font-bold text-primary">LaneYa</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t("stepOf", { step })}
            </span>
            <span className="text-muted-foreground">
              {step === 1 ? t("step1Label") : t("step2Label")}
            </span>
          </div>
          <Progress value={step * 50} className="h-2" />
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {t("personalTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel>{t("fullName")}</FieldLabel>
                    <Input
                      placeholder={t("fullNamePh")}
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </Field>

                  <Field>
                    <FieldLabel>{t("usernameLogin")}</FieldLabel>
                    <Input
                      type="text"
                      autoComplete="username"
                      placeholder={t("usernamePh")}
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                    />
                  </Field>

                  <Field>
                    <FieldLabel>{t("phone")}</FieldLabel>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        placeholder={t("phonePh")}
                        maxLength={12}
                        className="pl-10 tabular-nums"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            phone: formatThaiMobileInput(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={sendingOtp}
                        onClick={async () => {
                          const phoneDigits = phoneDigitsOnly(formData.phone)
                          if (phoneDigits.length !== 10) {
                            toast.error(t("phoneRule"))
                            return
                          }
                          setSendingOtp(true)
                          try {
                            const res = await requestPhoneOtp(phoneDigits)
                            setOtpSent(true)
                            setOtpVerified(false)
                            setPhoneVerifyToken("")
                            toast.success(res.message)
                            if (res.devCode) {
                              toast.info(`${t("otpDevCode")}: ${res.devCode}`)
                            }
                          } catch (err) {
                            const msg =
                              err instanceof ApiError ? err.message : t("otpSendFail")
                            toast.error(msg)
                          } finally {
                            setSendingOtp(false)
                          }
                        }}
                      >
                        {sendingOtp ? t("otpSending") : t("otpSend")}
                      </Button>
                      {otpVerified ? (
                        <span className="text-xs text-success">{t("otpVerified")}</span>
                      ) : otpSent ? (
                        <span className="text-xs text-muted-foreground">
                          {t("otpSentHint")}
                        </span>
                      ) : null}
                    </div>
                    {otpSent ? (
                      <div className="mt-2 flex items-center gap-2">
                        <Input
                          inputMode="numeric"
                          maxLength={6}
                          placeholder={t("otpCodePh")}
                          value={otpCode}
                          onChange={(e) =>
                            setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={verifyingOtp}
                          onClick={async () => {
                            const phoneDigits = phoneDigitsOnly(formData.phone)
                            if (phoneDigits.length !== 10 || otpCode.length !== 6) {
                              toast.error(t("otpInvalid"))
                              return
                            }
                            setVerifyingOtp(true)
                            try {
                              const res = await verifyPhoneOtp(phoneDigits, otpCode)
                              setOtpVerified(true)
                              setPhoneVerifyToken(res.verifyToken)
                              toast.success(t("otpVerifyOk"))
                            } catch (err) {
                              const msg =
                                err instanceof ApiError ? err.message : t("otpVerifyFail")
                              toast.error(msg)
                            } finally {
                              setVerifyingOtp(false)
                            }
                          }}
                        >
                          {verifyingOtp ? t("otpVerifying") : t("otpVerify")}
                        </Button>
                      </div>
                    ) : null}
                  </Field>

                  <Field>
                    <FieldLabel>{t("password")}</FieldLabel>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder={t("password")}
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            password: e.target.value,
                          })
                        }
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </Field>

                  <Field>
                    <FieldLabel>{t("confirmPassword")}</FieldLabel>
                    <Input
                      type="password"
                      placeholder={t("confirmPassword")}
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          confirmPassword: e.target.value,
                        })
                      }
                    />
                  </Field>
                </FieldGroup>

                <Button
                  type="button"
                  className="w-full"
                  size="lg"
                  onClick={() => {
                    const u = normalizeUsername(formData.username)
                    const phoneDigits = phoneDigitsOnly(formData.phone)
                    if (!formData.name.trim() || !u || !formData.password) {
                      toast.error(t("fillAll"))
                      return
                    }
                    if (!USERNAME_PATTERN.test(u)) {
                      toast.error(t("usernameRule"))
                      return
                    }
                    if (phoneDigits.length !== 10) {
                      toast.error(t("phoneRule"))
                      return
                    }
                    if (!otpVerified || !phoneVerifyToken) {
                      toast.error(t("otpRequire"))
                      return
                    }
                    if (formData.password !== formData.confirmPassword) {
                      toast.error(t("mismatch"))
                      return
                    }
                    setStep(2)
                  }}
                >
                  {t("next")}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  {t("hasAccount")}{" "}
                  <Link href="/login" className="text-primary hover:underline">
                    {t("signIn")}
                  </Link>
                </p>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  {t("healthTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>{t("age")}</FieldLabel>
                    <Input
                      type="number"
                      placeholder="25"
                      value={formData.age}
                      onChange={(e) =>
                        setFormData({ ...formData, age: e.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("weight")}</FieldLabel>
                    <Input
                      type="number"
                      placeholder="70"
                      value={formData.weight}
                      onChange={(e) =>
                        setFormData({ ...formData, weight: e.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("height")}</FieldLabel>
                    <Input
                      type="number"
                      placeholder="170"
                      value={formData.height}
                      onChange={(e) =>
                        setFormData({ ...formData, height: e.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{tHealth("genderLabel")}</FieldLabel>
                    <Select
                      value={formData.gender || undefined}
                      onValueChange={(v) =>
                        setFormData({ ...formData, gender: v })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={tHealth("genderPh")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">
                          {tHealth("genderMale")}
                        </SelectItem>
                        <SelectItem value="female">
                          {tHealth("genderFemale")}
                        </SelectItem>
                        <SelectItem value="other">
                          {tHealth("genderOther")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <HealthProfileFields
                  idPrefix="register"
                  allergiesText={formData.allergiesText}
                  onAllergiesTextChange={(allergiesText) =>
                    setFormData((prev) => ({ ...prev, allergiesText }))
                  }
                  noAllergies={formData.noAllergies}
                  onNoAllergiesChange={(noAllergies) =>
                    setFormData((prev) => ({ ...prev, noAllergies }))
                  }
                  diseasesText={formData.diseasesText}
                  onDiseasesTextChange={(diseasesText) =>
                    setFormData((prev) => ({ ...prev, diseasesText }))
                  }
                  noDiseases={formData.noDiseases}
                  onNoDiseasesChange={(noDiseases) =>
                    setFormData((prev) => ({ ...prev, noDiseases }))
                  }
                />

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Pill className="h-4 w-4 shrink-0 text-primary" />
                    <span className="font-medium text-foreground">
                      {tHealth("medicationsTitle")}
                    </span>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="register-medications-text">
                      {tHealth("medicationsLabel")}
                    </FieldLabel>
                    <Textarea
                      id="register-medications-text"
                      placeholder={tHealth("medicationsPh")}
                      rows={4}
                      value={formData.currentMedications}
                      disabled={formData.noMedications}
                      onChange={(e) => {
                        const v = e.target.value
                        setFormData((prev) => ({
                          ...prev,
                          currentMedications: v,
                          noMedications: v.trim() ? false : prev.noMedications,
                        }))
                      }}
                      className="min-h-[100px] resize-y"
                    />
                  </Field>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="register-no-medications"
                      checked={formData.noMedications}
                      onCheckedChange={(checked) => {
                        const on = checked === true
                        setFormData((prev) => ({
                          ...prev,
                          noMedications: on,
                          currentMedications: on ? "" : prev.currentMedications,
                        }))
                      }}
                    />
                    <label
                      htmlFor="register-no-medications"
                      className="text-sm leading-snug text-muted-foreground"
                    >
                      {tHealth("noMedications")}
                    </label>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="consent"
                      checked={formData.consent}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          consent: checked as boolean,
                        })
                      }
                    />
                    <label
                      htmlFor="consent"
                      className="text-sm text-muted-foreground leading-relaxed"
                    >
                      {t("consentLong")}
                    </label>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep(1)}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    {t("back")}
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={!formData.consent || loading}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    {loading ? t("submitting") : t("confirm")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      </div>
    </div>
  )
}
