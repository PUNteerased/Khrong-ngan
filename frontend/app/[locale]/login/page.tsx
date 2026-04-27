"use client"

import { useState, type FormEvent } from "react"
import { Link, useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { UserRound, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { loginUser, ApiError } from "@/lib/api"
import { setStoredToken } from "@/lib/auth-token"
import { normalizeUsername } from "@/lib/username"

export default function LoginPage() {
  const router = useRouter()
  const t = useTranslations("Login")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { accessToken } = await loginUser(
        normalizeUsername(formData.username),
        formData.password
      )
      setStoredToken(accessToken)
      toast.success(t("success"))
      router.push("/")
      router.refresh()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("failGeneric")
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] flex items-center justify-center px-4 py-8 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="flex flex-col items-center justify-center gap-3">
            <span className="text-4xl font-bold text-primary">LaneYa</span>
          </div>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>{t("username")}</FieldLabel>
                  <div className="relative">
                    <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      autoComplete="username"
                      placeholder={t("username")}
                      className="pl-10"
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          username: e.target.value,
                        })
                      }
                    />
                  </div>
                </Field>

                <Field>
                  <FieldLabel>{t("password")}</FieldLabel>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={t("password")}
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
              </FieldGroup>

              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  {t("forgot")}
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading ? t("submitting") : t("submit")}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-card px-2 text-muted-foreground">{t("or")}</span>
              </div>
            </div>

            <Link href="/register">
              <Button variant="outline" className="w-full" size="lg">
                {t("registerCta")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
