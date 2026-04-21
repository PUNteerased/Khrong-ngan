"use client"

import { useState, useEffect } from "react"
import { Link, useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  User,
  Edit2,
  Scale,
  Settings,
  ChevronRight,
  LogOut,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { HealthProfileFields } from "@/components/health-profile-fields"
import { ImageUploader } from "@/components/image-uploader"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
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
import { fetchMe, patchMe, ApiError } from "@/lib/api"
import { getStoredToken, setStoredToken } from "@/lib/auth-token"

export default function ProfilePage() {
  const router = useRouter()
  const t = useTranslations("Profile")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [phone, setPhone] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [ageStr, setAgeStr] = useState("")
  const [weightStr, setWeightStr] = useState("")
  const [allergiesText, setAllergiesText] = useState("")
  const [noAllergies, setNoAllergies] = useState(false)
  const [diseasesText, setDiseasesText] = useState("")
  const [noDiseases, setNoDiseases] = useState(false)

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
        setFullName(u.fullName)
        setUsername(u.username)
        setPhone(u.phone)
        setAvatarUrl(u.avatarUrl ?? null)
        setAgeStr(u.age != null ? String(u.age) : "")
        setWeightStr(u.weight != null ? String(u.weight) : "")
        setAllergiesText(u.allergiesText)
        setNoAllergies(u.noAllergies)
        setDiseasesText(u.diseasesText)
        setNoDiseases(u.noDiseases)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setStoredToken(null)
          router.push("/login")
        } else {
          toast.error(t("loadFail"))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router, t])

  const handleSave = async () => {
    setSaving(true)
    try {
      await patchMe({
        fullName: fullName.trim(),
        age: ageStr === "" ? null : Number(ageStr),
        weight: weightStr === "" ? null : Number(weightStr),
        allergiesText,
        noAllergies,
        diseasesText,
        noDiseases,
      })
      toast.success(t("saveOk"))
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("saveFail")
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

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

  const handleLogout = () => {
    setStoredToken(null)
    toast.success(t("logoutOk"))
    router.push("/login")
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-60px)] items-center justify-center">
        <Spinner className="h-8 w-8" />
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
                  <Edit2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-8"
                    placeholder={t("fullNamePh")}
                  />
                </div>
                <p className="text-sm text-muted-foreground pl-6">@{username}</p>
                {phone ? (
                  <p className="text-sm text-muted-foreground pl-6 tabular-nums">
                    {formatThaiMobileInput(phone)}
                  </p>
                ) : null}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Scale className="h-4 w-4" />
                {t("bodyTitle")}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("ageLabel")}</p>
                  <Input
                    type="number"
                    value={ageStr}
                    onChange={(e) => setAgeStr(e.target.value)}
                    placeholder="25"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t("weightLabel")}
                  </p>
                  <Input
                    type="number"
                    value={weightStr}
                    onChange={(e) => setWeightStr(e.target.value)}
                    placeholder="70"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <HealthProfileFields
              idPrefix="profile"
              allergiesText={allergiesText}
              onAllergiesTextChange={setAllergiesText}
              noAllergies={noAllergies}
              onNoAllergiesChange={setNoAllergies}
              diseasesText={diseasesText}
              onDiseasesTextChange={setDiseasesText}
              noDiseases={noDiseases}
              onNoDiseasesChange={setNoDiseases}
            />

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? t("saving") : t("saveProfile")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t("accountTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
