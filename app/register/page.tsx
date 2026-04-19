"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { AppLogo } from "@/components/app-logo"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { HealthProfileFields } from "@/components/health-profile-fields"
import { Progress } from "@/components/ui/progress"
import { registerUser, ApiError } from "@/lib/api"
import { setStoredToken } from "@/lib/auth-token"
import { formatThaiMobileInput, phoneDigitsOnly } from "@/lib/phone-format"
import { normalizeUsername, USERNAME_PATTERN } from "@/lib/username"

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    phone: "",
    password: "",
    confirmPassword: "",
    age: "",
    weight: "",
    allergiesText: "",
    noAllergies: false,
    diseasesText: "",
    noDiseases: false,
    consent: false,
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (step !== 2) return
    if (formData.password !== formData.confirmPassword) {
      toast.error("รหัสผ่านไม่ตรงกัน")
      return
    }
    setLoading(true)
    try {
      const phoneDigits = phoneDigitsOnly(formData.phone)
      const { accessToken } = await registerUser({
        username: normalizeUsername(formData.username),
        ...(phoneDigits.length > 0 ? { phone: phoneDigits } : {}),
        password: formData.password,
        fullName: formData.name.trim(),
        age: formData.age ? Number(formData.age) : null,
        weight: formData.weight ? Number(formData.weight) : null,
        allergiesText: formData.allergiesText,
        noAllergies: formData.noAllergies,
        diseasesText: formData.diseasesText,
        noDiseases: formData.noDiseases,
      })
      setStoredToken(accessToken)
      toast.success("ลงทะเบียนสำเร็จ")
      router.push("/")
      router.refresh()
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "ลงทะเบียนไม่สำเร็จ"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] px-4 py-6 bg-background">
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="flex flex-col items-center gap-2 pb-2">
          <AppLogo size={56} className="rounded-lg" priority />
          <span className="text-2xl font-bold text-primary">LaneYa</span>
        </div>
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">ขั้นตอนที่ {step}/2</span>
            <span className="text-muted-foreground">
              {step === 1 ? "ข้อมูลส่วนตัว" : "ข้อมูลสุขภาพ"}
            </span>
          </div>
          <Progress value={step * 50} className="h-2" />
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 1: Personal Info */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  ข้อมูลส่วนตัว
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel>ชื่อ-นามสกุล</FieldLabel>
                    <Input
                      placeholder="กรอกชื่อ-นามสกุล"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </Field>

                  <Field>
                    <FieldLabel>ชื่อผู้ใช้ (เข้าสู่ระบบ)</FieldLabel>
                    <Input
                      type="text"
                      autoComplete="username"
                      placeholder="a–z ตัวเลข . _ - (3–32 ตัว)"
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                    />
                  </Field>

                  <Field>
                    <FieldLabel>เบอร์โทรศัพท์ (ไม่บังคับ)</FieldLabel>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        placeholder="081-234-5678"
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
                  </Field>

                  <Field>
                    <FieldLabel>รหัสผ่าน</FieldLabel>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="รหัสผ่าน"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
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
                    <FieldLabel>ยืนยันรหัสผ่าน</FieldLabel>
                    <Input
                      type="password"
                      placeholder="ยืนยันรหัสผ่าน"
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
                    if (
                      !formData.name.trim() ||
                      !u ||
                      !formData.password
                    ) {
                      toast.error("กรุณากรอกข้อมูลให้ครบ")
                      return
                    }
                    if (!USERNAME_PATTERN.test(u)) {
                      toast.error(
                        "ชื่อผู้ใช้ต้องเป็น a–z ตัวเลข . _ - ความยาว 3–32 ตัว"
                      )
                      return
                    }
                    if (
                      phoneDigits.length > 0 &&
                      phoneDigits.length !== 10
                    ) {
                      toast.error("เบอร์โทรต้องเป็นตัวเลข 10 หลัก หรือเว้นว่าง")
                      return
                    }
                    if (formData.password !== formData.confirmPassword) {
                      toast.error("รหัสผ่านไม่ตรงกัน")
                      return
                    }
                    setStep(2)
                  }}
                >
                  ถัดไป
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  มีบัญชีอยู่แล้ว?{" "}
                  <Link href="/login" className="text-primary hover:underline">
                    เข้าสู่ระบบ
                  </Link>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Health Profile */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  ข้อมูลสุขภาพ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Physical Info */}
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>อายุ (ปี)</FieldLabel>
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
                    <FieldLabel>น้ำหนัก (กก.)</FieldLabel>
                    <Input
                      type="number"
                      placeholder="70"
                      value={formData.weight}
                      onChange={(e) =>
                        setFormData({ ...formData, weight: e.target.value })
                      }
                    />
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

                {/* PDPA Consent */}
                <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="consent"
                      checked={formData.consent}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, consent: checked as boolean })
                      }
                    />
                    <label
                      htmlFor="consent"
                      className="text-sm text-muted-foreground leading-relaxed"
                    >
                      ข้าพเจ้ายินยอมให้ระบบประมวลผลข้อมูลสุขภาพเพื่อใช้ในการประเมินอาการและจ่ายยาเบื้องต้น
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
                    ย้อนกลับ
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={!formData.consent || loading}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    {loading ? "กำลังส่ง…" : "ยืนยัน"}
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
