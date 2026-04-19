"use client"

import { useState, useEffect, useCallback, type FormEvent } from "react"
import {
  LayoutDashboard,
  Package,
  FileText,
  Cpu,
  Users,
  CheckCircle,
  AlertTriangle,
  Plus,
  RefreshCw,
  Wifi,
  WifiOff,
  Play,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import {
  fetchDrugs,
  fetchAdminStats,
  fetchAdminSessions,
  fetchTopDrugs,
  restockDrug,
  adminLogin,
  type DrugDto,
  type AdminStats,
  type AdminSessionRow,
  ApiError,
} from "@/lib/api"
import {
  getStoredAdminToken,
  setStoredAdminToken,
} from "@/lib/admin-token"
import { normalizeUsername, USERNAME_PATTERN } from "@/lib/username"

function stockStatus(q: number): "normal" | "low" | "empty" {
  if (q === 0) return "empty"
  if (q <= 5) return "low"
  return "normal"
}

export default function AdminPage() {
  const [isOnline] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [adminUsername, setAdminUsername] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [drugs, setDrugs] = useState<DrugDto[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [sessions, setSessions] = useState<AdminSessionRow[]>([])
  const [topDrugs, setTopDrugs] = useState<{ drug: DrugDto | null; count: number }[]>([])

  useEffect(() => {
    setUnlocked(!!getStoredAdminToken())
    setAuthReady(true)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [d, s, sess, top] = await Promise.all([
        fetchDrugs(),
        fetchAdminStats(),
        fetchAdminSessions(),
        fetchTopDrugs(),
      ])
      setDrugs(d)
      setStats(s)
      setSessions(sess)
      setTopDrugs(top)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setStoredAdminToken(null)
        setUnlocked(false)
        toast.error("หมดเวลาเข้าสู่ระบบผู้ดูแล — กรุณาเข้าใหม่")
        return
      }
      toast.error(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authReady || !unlocked) return
    loadAll()
  }, [authReady, unlocked, loadAll])

  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    try {
      const u = normalizeUsername(adminUsername)
      if (!USERNAME_PATTERN.test(u)) {
        toast.error(
          "ชื่อผู้ใช้ต้องเป็น a–z ตัวเลข . _ - ความยาว 3–32 ตัว"
        )
        return
      }
      const { accessToken } = await adminLogin(u, adminPassword)
      setStoredAdminToken(accessToken)
      setAdminUsername("")
      setAdminPassword("")
      setUnlocked(true)
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "เข้าสู่ระบบไม่สำเร็จ"
      )
    } finally {
      setLoginLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "normal":
        return (
          <Badge className="bg-success/20 text-success hover:bg-success/30">
            สต็อกปกติ
          </Badge>
        )
      case "low":
        return (
          <Badge className="bg-warning/20 text-warning-foreground hover:bg-warning/30">
            สต็อกต่ำ
          </Badge>
        )
      case "empty":
        return <Badge variant="destructive">ยาหมด</Badge>
      default:
        return null
    }
  }

  const handleRestock = async (drug: DrugDto) => {
    const raw = window.prompt(`เติมสต็อก ${drug.name} (จำนวนแผง/ชิ้น)`, "5")
    if (raw === null) return
    const add = parseInt(raw, 10)
    if (Number.isNaN(add) || add <= 0) {
      toast.error("กรุณากรอกตัวเลขมากกว่า 0")
      return
    }
    try {
      await restockDrug(drug.id, add)
      toast.success("เติมสต็อกแล้ว")
      loadAll()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "เติมไม่สำเร็จ")
    }
  }

  const statCards = stats
    ? [
        {
          label: "ผู้ใช้งานวันนี้",
          value: String(stats.usersToday),
          icon: Users,
          color: "text-blue-500",
        },
        {
          label: "จ่ายยาสำเร็จ",
          value: String(stats.dispensedToday),
          icon: CheckCircle,
          color: "text-success",
        },
        {
          label: "การแจ้งเตือน",
          value: String(stats.alerts),
          icon: AlertTriangle,
          color: "text-warning",
        },
      ]
    : []

  const maxTop = Math.max(
    1,
    ...topDrugs.map((t) => t.count),
    1
  )

  if (!authReady) {
    return (
      <div className="flex min-h-[calc(100vh-60px)] justify-center items-center">
        <Spinner className="h-10 w-10" />
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex items-center justify-center px-4 bg-background">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-lg">เข้าสู่ระบบผู้ดูแล</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              ใช้ชื่อผู้ใช้และรหัสผ่านของบัญชีที่ถูกตั้งค่าเป็นผู้ดูแลในระบบเท่านั้น
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <Input
                type="text"
                autoComplete="username"
                placeholder="ชื่อผู้ใช้ผู้ดูแล"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
              />
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="รหัสผ่าน"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={
                  loginLoading ||
                  !normalizeUsername(adminUsername) ||
                  !USERNAME_PATTERN.test(normalizeUsername(adminUsername)) ||
                  !adminPassword.trim()
                }
              >
                {loginLoading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-background pb-8">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStoredAdminToken(null)
                setUnlocked(false)
                setStats(null)
                setSessions([])
                setTopDrugs([])
              }}
            >
              ออกจากระบบผู้ดูแล
            </Button>
            <Button variant="outline" size="sm" onClick={() => loadAll()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              รีเฟรช
            </Button>
            <Badge
              variant="outline"
              className={
                isOnline
                  ? "border-success text-success"
                  : "border-destructive text-destructive"
              }
            >
              {isOnline ? (
                <Wifi className="h-3 w-3 mr-1" />
              ) : (
                <WifiOff className="h-3 w-3 mr-1" />
              )}
              {isOnline ? "ตู้ออนไลน์" : "ตู้ออฟไลน์"}
            </Badge>
          </div>
        </div>

        {loading && !stats ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-10 w-10" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {statCards.map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center text-center gap-2">
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                      <p className="text-2xl font-bold text-foreground">
                        {stat.value}
                      </p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Tabs defaultValue="overview">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="overview" className="text-xs sm:text-sm">
                  <LayoutDashboard className="h-4 w-4 mr-1 hidden sm:inline" />
                  ภาพรวม
                </TabsTrigger>
                <TabsTrigger value="inventory" className="text-xs sm:text-sm">
                  <Package className="h-4 w-4 mr-1 hidden sm:inline" />
                  สต็อก
                </TabsTrigger>
                <TabsTrigger value="logs" className="text-xs sm:text-sm">
                  <FileText className="h-4 w-4 mr-1 hidden sm:inline" />
                  ประวัติ
                </TabsTrigger>
                <TabsTrigger value="hardware" className="text-xs sm:text-sm">
                  <Cpu className="h-4 w-4 mr-1 hidden sm:inline" />
                  ฮาร์ดแวร์
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      ยาที่ถูกอ้างอิงในแชท (สะสม)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {topDrugs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        ยังไม่มีข้อมูลแนะนำยาจากแชท
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {topDrugs.map((row, i) => (
                          <div
                            key={row.drug?.id ?? i}
                            className="flex items-center justify-between"
                          >
                            <span className="text-sm text-foreground">
                              {row.drug?.name ?? "—"}
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{
                                    width: `${Math.min(100, (row.count / maxTop) * 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {row.count} ครั้ง
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="inventory" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      จัดการสต็อกและช่องจ่ายยา
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">ช่อง</TableHead>
                            <TableHead>ชื่อยา</TableHead>
                            <TableHead className="text-center">คงเหลือ</TableHead>
                            <TableHead className="text-center">สถานะ</TableHead>
                            <TableHead className="text-right">จัดการ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {drugs.map((item) => {
                            const st = stockStatus(item.quantity)
                            return (
                              <TableRow key={item.id}>
                                <TableCell className="font-mono font-medium">
                                  {item.slotId}
                                </TableCell>
                                <TableCell>{item.name}</TableCell>
                                <TableCell className="text-center">
                                  {item.quantity}
                                </TableCell>
                                <TableCell className="text-center">
                                  {getStatusBadge(st)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRestock(item)}
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    เติม
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logs" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">ประวัติการแชท / จ่ายยา</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>วัน/เวลา</TableHead>
                            <TableHead>ผู้ใช้</TableHead>
                            <TableHead>สรุป</TableHead>
                            <TableHead>ยา</TableHead>
                            <TableHead className="text-center">QR</TableHead>
                            <TableHead className="text-center">ตู้</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sessions.map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell className="whitespace-nowrap text-sm">
                                {new Date(tx.date).toLocaleString("th-TH")}
                              </TableCell>
                              <TableCell className="text-sm">{tx.userLabel}</TableCell>
                              <TableCell className="text-sm max-w-[120px] truncate">
                                {tx.summary}
                              </TableCell>
                              <TableCell className="text-sm">{tx.drug}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="text-xs">
                                  {tx.qrStatus}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="text-xs">
                                  {tx.machineStatus}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="hardware" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Cpu className="h-5 w-5" />
                      สถานะตู้จ่ายยา
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        {isOnline ? (
                          <Wifi className="h-5 w-5 text-success" />
                        ) : (
                          <WifiOff className="h-5 w-5 text-destructive" />
                        )}
                        <div>
                          <p className="font-medium text-foreground">
                            สถานะการเชื่อมต่อ
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {isOnline
                              ? "เชื่อมต่อกับเว็บแล้ว"
                              : "ไม่สามารถเชื่อมต่อได้"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={isOnline ? "default" : "destructive"}
                        className={isOnline ? "bg-success hover:bg-success/80" : ""}
                      >
                        {isOnline ? "Online" : "Offline"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" className="h-auto py-4" type="button">
                        <div className="flex flex-col items-center gap-2">
                          <Play className="h-5 w-5" />
                          <span className="text-xs">ทดสอบมอเตอร์</span>
                        </div>
                      </Button>
                      <Button variant="outline" className="h-auto py-4" type="button">
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="h-5 w-5" />
                          <span className="text-xs">รีเซ็ตระบบตู้</span>
                        </div>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  )
}
