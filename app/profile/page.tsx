"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [phone, setPhone] = useState("")
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
          toast.error("โหลดข้อมูลไม่สำเร็จ")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

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
      toast.success("บันทึกแล้ว")
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    setStoredToken(null)
    toast.success("ออกจากระบบแล้ว")
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
      <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-muted-foreground">กรุณาเข้าสู่ระบบเพื่อดูโปรไฟล์</p>
        <Button asChild>
          <Link href="/login">เข้าสู่ระบบ</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-background pb-8">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              โปรไฟล์และข้อมูลสุขภาพ
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              อายุ น้ำหนัก ประวัติแพ้ยา และโรคประจำตัว ใช้ประกอบการให้คำแนะนำจากแชตบอท
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="min-w-0 flex-1 space-y-2 pr-2">
                <div className="flex items-center gap-2">
                  <Edit2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-8"
                    placeholder="ชื่อ-นามสกุล"
                  />
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  @{username}
                </p>
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
                ข้อมูลร่างกาย
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">อายุ (ปี)</p>
                  <Input
                    type="number"
                    value={ageStr}
                    onChange={(e) => setAgeStr(e.target.value)}
                    placeholder="25"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">น้ำหนัก (กก.)</p>
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

            <Button
              className="w-full"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "กำลังบันทึก…" : "บันทึกโปรไฟล์"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">บัญชี</CardTitle>
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
              ออกจากระบบ
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                  size="lg"
                >
                  <Trash2 className="h-5 w-5" />
                  ลบบัญชีผู้ใช้งาน
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>ยืนยันการลบบัญชี</AlertDialogTitle>
                  <AlertDialogDescription>
                    การดำเนินการนี้ไม่สามารถย้อนกลับได้
                    ข้อมูลสุขภาพและประวัติการใช้งานทั้งหมดจะถูกลบออกอย่างถาวร
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    ลบบัญชี
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
              <p className="font-medium">การตั้งค่าแอป</p>
              <p className="text-sm text-muted-foreground">
                ธีม ภาษา ความเป็นส่วนตัว และคุกกี้
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </Link>
      </div>
    </div>
  )
}
