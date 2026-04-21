"use client"

import { useState, useEffect } from "react"
import { Link, useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Settings, ChevronRight, LogOut, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
import { ImageUploader } from "@/components/image-uploader"
import {
  MultiStepProfileForm,
  type ProfileFormData,
} from "@/components/multi-step-profile-form"
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
import { fetchMe, patchMe, ApiError } from "@/lib/api"
import { getStoredToken, setStoredToken } from "@/lib/auth-token"

function ProfileSkeleton() {
  return (
    <div className="min-h-[calc(100vh-60px)] bg-background pb-8">
      <div className="mx-auto w-full max-w-4xl px-2 py-6 sm:px-4 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <Skeleton className="h-24 w-24 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-2 w-full" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const t = useTranslations("Profile")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [username, setUsername] = useState("")
  const [initialData, setInitialData] = useState<ProfileFormData | null>(null)

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
        setAvatarUrl(u.avatarUrl ?? null)
        setInitialData({
          fullName: u.fullName,
          age: u.age ?? null,
          weight: u.weight ?? null,
          height: u.height ?? null,
          gender: u.gender ?? null,
          allergiesText: u.allergiesText,
          noAllergies: u.noAllergies,
          diseasesText: u.diseasesText,
          noDiseases: u.noDiseases,
          currentMedications: u.currentMedications,
          noMedications:
            u.currentMedications.trim() === "" ||
            u.currentMedications.trim() === "ไม่มี",
        })
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

  const handleSave = async (data: ProfileFormData) => {
    setSaving(true)
    try {
      await patchMe({
        fullName: data.fullName.trim(),
        age: data.age,
        weight: data.weight,
        height: data.height,
        gender: data.gender?.trim() === "" ? null : data.gender,
        allergiesText: data.allergiesText,
        noAllergies: data.noAllergies,
        diseasesText: data.diseasesText,
        noDiseases: data.noDiseases,
        currentMedications: data.noMedications ? "ไม่มี" : data.currentMedications,
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
    return <ProfileSkeleton />
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

  if (!initialData) {
    return (
      <div className="flex min-h-[calc(100vh-60px)] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-background pb-8">
      <div className="mx-auto w-full max-w-4xl px-2 py-6 sm:px-4 space-y-6">
        {/* Avatar Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t("title")}</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              {t("subtitle")}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/50 p-4">
              <ImageUploader
                folder="avatars"
                shape="circle"
                value={avatarUrl}
                onChange={(url) => void handleAvatarChange(url)}
                disabled={saving}
                label={t("avatarLabel")}
                size={96}
              />
              <p className="text-sm text-muted-foreground">@{username}</p>
            </div>
          </CardContent>
        </Card>

        {/* Multi-step Profile Form */}
        <MultiStepProfileForm
          initialData={initialData}
          onSave={handleSave}
          saving={saving}
        />

        {/* Account Actions */}
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
