"use client"

import { useState } from "react"
import { Link, useRouter } from "@/i18n/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  requestPasswordReset,
  confirmPasswordReset,
  ApiError,
} from "@/lib/api"
import { normalizeUsername } from "@/lib/username"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const sendOtp = async () => {
    const u = normalizeUsername(username)
    const em = email.trim().toLowerCase()
    if (!u || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      toast.error("กรุณากรอกชื่อผู้ใช้และอีเมลให้ถูกต้อง")
      return
    }
    setSending(true)
    try {
      const res = await requestPasswordReset(u, em)
      setOtpSent(true)
      toast.success(res.message)
      if (res.devCode) toast.info(`โค้ดทดสอบ: ${res.devCode}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่ง OTP ไม่สำเร็จ")
    } finally {
      setSending(false)
    }
  }

  const resetPassword = async () => {
    const u = normalizeUsername(username)
    const em = email.trim().toLowerCase()
    if (!u || !em || otp.length !== 6 || newPassword.length < 6) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("รหัสผ่านใหม่ไม่ตรงกัน")
      return
    }
    setSubmitting(true)
    try {
      const res = await confirmPasswordReset(u, em, otp, newPassword)
      toast.success(res.message)
      router.push("/login")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "รีเซ็ตรหัสผ่านไม่สำเร็จ")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] flex items-center justify-center px-4 py-8 bg-background">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>ลืมรหัสผ่าน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel>ชื่อผู้ใช้</FieldLabel>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </Field>
              <Field>
                <FieldLabel>อีเมล</FieldLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </Field>
            </FieldGroup>

            <Button type="button" variant="outline" className="w-full" onClick={() => void sendOtp()} disabled={sending}>
              {sending ? "กำลังส่ง OTP…" : "ส่ง OTP รีเซ็ตรหัสผ่าน"}
            </Button>

            {otpSent ? (
              <div className="space-y-3">
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="กรอกรหัส OTP 6 หลัก"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <Input
                  type="password"
                  placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="ยืนยันรหัสผ่านใหม่"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => void resetPassword()}
                  disabled={submitting}
                >
                  {submitting ? "กำลังตั้งรหัสผ่านใหม่…" : "ยืนยันตั้งรหัสผ่านใหม่"}
                </Button>
              </div>
            ) : null}

            <p className="text-center text-sm text-muted-foreground">
              กลับไปหน้า <Link href="/login" className="text-primary hover:underline">เข้าสู่ระบบ</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
