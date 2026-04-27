"use client"

import { useState, useEffect, useCallback, type FormEvent } from "react"
import { useLocale, useTranslations } from "next-intl"
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
  Pencil,
  Trash2,
  UserPlus,
  Database,
  Cloud,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import {
  fetchDrugs,
  fetchAdminStats,
  fetchAdminSessions,
  restockDrug,
  adminLogin,
  fetchAdminHealth,
  fetchAdminOverview,
  deleteDrug,
  fetchAdminUsers,
  deleteAdminUser,
  type DrugDto,
  type AdminStats,
  type AdminSessionRow,
  type AdminHealth,
  type AdminOverview,
  type AdminUserRow,
  ApiError,
} from "@/lib/api"
import {
  getStoredAdminToken,
  setStoredAdminToken,
} from "@/lib/admin-token"
import { normalizeUsername, USERNAME_PATTERN } from "@/lib/username"
import { AdminDrugDialog } from "@/components/admin-drug-dialog"
import { AdminSessionSheet } from "@/components/admin-session-sheet"
import { AdminUserSheet } from "@/components/admin-user-sheet"

function stockStatus(q: number, threshold: number): "normal" | "low" | "empty" {
  if (q === 0) return "empty"
  if (q <= threshold) return "low"
  return "normal"
}

export default function AdminPage() {
  const locale = useLocale()
  const t = useTranslations("Admin")
  const [authReady, setAuthReady] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [adminUsername, setAdminUsername] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [drugs, setDrugs] = useState<DrugDto[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [sessions, setSessions] = useState<AdminSessionRow[]>([])
  const [sessionTotal, setSessionTotal] = useState(0)
  const [health, setHealth] = useState<AdminHealth | null>(null)
  const [mainTab, setMainTab] = useState("overview")
  const [logQuery, setLogQuery] = useState("")
  const [redFlagOnly, setRedFlagOnly] = useState(false)
  const [userQuery, setUserQuery] = useState("")
  const [userRows, setUserRows] = useState<AdminUserRow[]>([])
  const [userTotal, setUserTotal] = useState(0)
  const [sessionPick, setSessionPick] = useState<string | null>(null)
  const [sessionOpen, setSessionOpen] = useState(false)
  const [userPick, setUserPick] = useState<string | null>(null)
  const [userOpen, setUserOpen] = useState(false)
  const [drugDialogOpen, setDrugDialogOpen] = useState(false)
  const [drugEdit, setDrugEdit] = useState<DrugDto | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteUserPick, setDeleteUserPick] = useState<{
    id: string
    name: string
  } | null>(null)

  useEffect(() => {
    setUnlocked(!!getStoredAdminToken())
    setAuthReady(true)
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      const r = await fetchAdminSessions({
        q: logQuery.trim() || undefined,
        redFlagOnly,
        limit: 50,
      })
      setSessions(r.items)
      setSessionTotal(r.total)
    } catch {
      /* toast in loadAll */
    }
  }, [logQuery, redFlagOnly])

  const loadUsers = useCallback(async () => {
    try {
      const r = await fetchAdminUsers({
        query: userQuery.trim() || undefined,
        limit: 40,
      })
      setUserRows(r.items)
      setUserTotal(r.total)
    } catch {
      /* ignore */
    }
  }, [userQuery])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [d, s, ov, h, sess, ur] = await Promise.all([
        fetchDrugs(),
        fetchAdminStats(),
        fetchAdminOverview(),
        fetchAdminHealth(),
        fetchAdminSessions({
          q: logQuery.trim() || undefined,
          redFlagOnly,
          limit: 50,
        }),
        fetchAdminUsers({ query: userQuery.trim() || undefined, limit: 40 }),
      ])
      setDrugs(d)
      setStats(s)
      setOverview(ov)
      setHealth(h)
      setSessions(sess.items)
      setSessionTotal(sess.total)
      setUserRows(ur.items)
      setUserTotal(ur.total)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setStoredAdminToken(null)
        setUnlocked(false)
        toast.error(t("sessionExpired"))
        return
      }
      toast.error(e instanceof ApiError ? e.message : t("loadFail"))
    } finally {
      setLoading(false)
    }
  }, [t, logQuery, redFlagOnly, userQuery])

  useEffect(() => {
    if (!authReady || !unlocked) return
    loadAll()
  }, [authReady, unlocked, loadAll])

  useEffect(() => {
    if (!unlocked) return
    const tmr = setTimeout(() => {
      void loadSessions()
    }, 300)
    return () => clearTimeout(tmr)
  }, [unlocked, logQuery, redFlagOnly, loadSessions])

  useEffect(() => {
    if (!unlocked) return
    const tmr = setTimeout(() => {
      void loadUsers()
    }, 300)
    return () => clearTimeout(tmr)
  }, [unlocked, userQuery, loadUsers])

  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    try {
      const u = normalizeUsername(adminUsername)
      if (!USERNAME_PATTERN.test(u)) {
        toast.error(t("usernameRule"))
        return
      }
      const { accessToken } = await adminLogin(u, adminPassword)
      setStoredAdminToken(accessToken)
      setAdminUsername("")
      setAdminPassword("")
      setUnlocked(true)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("loginFail"))
    } finally {
      setLoginLoading(false)
    }
  }

  const threshold = stats?.lowStockThreshold ?? 5

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "normal":
        return (
          <Badge className="bg-success/20 text-success hover:bg-success/30">
            {t("stockNormal")}
          </Badge>
        )
      case "low":
        return (
          <Badge className="bg-warning/20 text-warning-foreground hover:bg-warning/30">
            {t("stockLow")}
          </Badge>
        )
      case "empty":
        return <Badge variant="destructive">{t("stockEmpty")}</Badge>
      default:
        return null
    }
  }

  const handleRestock = async (drug: DrugDto) => {
    const raw = window.prompt(t("restockPrompt", { name: drug.name }), "5")
    if (raw === null) return
    const add = parseInt(raw, 10)
    if (Number.isNaN(add) || add <= 0) {
      toast.error(t("restockInvalid"))
      return
    }
    try {
      await restockDrug(drug.id, add)
      toast.success(t("restockOk"))
      loadAll()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("restockFail"))
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      await deleteDrug(deleteId)
      toast.success(t("drugDeleted"))
      setDeleteId(null)
      loadAll()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("loadFail"))
    }
  }

  const confirmDeleteUser = async () => {
    if (!deleteUserPick) return
    try {
      await deleteAdminUser(deleteUserPick.id)
      toast.success(t("userDeleted"))
      setDeleteUserPick(null)
      if (userPick === deleteUserPick.id) {
        setUserOpen(false)
        setUserPick(null)
      }
      loadUsers()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("loadFail"))
    }
  }

  const statCards = stats
    ? [
        {
          label: t("statActiveUsers"),
          value: String(stats.activeUsersToday),
          icon: Users,
          color: "text-blue-500",
        },
        {
          label: t("statChats"),
          value: String(stats.chatsToday),
          icon: LayoutDashboard,
          color: "text-violet-500",
        },
        {
          label: t("statDispensed"),
          value: String(stats.dispensedToday),
          icon: CheckCircle,
          color: "text-success",
        },
        {
          label: t("statLowStock"),
          value: String(stats.lowStockDrugCount),
          icon: AlertTriangle,
          color: "text-warning",
        },
        {
          label: t("statRedFlags"),
          value: String(stats.redFlagsToday),
          icon: AlertTriangle,
          color: "text-destructive",
        },
        {
          label: t("statNewUsers"),
          value: String(stats.newUsersToday),
          icon: UserPlus,
          color: "text-muted-foreground",
        },
      ]
    : []

  const kioskOnline = health?.cabinet === true

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
            <CardTitle className="text-lg">{t("loginTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              {t("loginHint")}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <Input
                type="text"
                autoComplete="username"
                placeholder={t("adminUserPh")}
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
              />
              <Input
                type="password"
                autoComplete="current-password"
                placeholder={t("password")}
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
                {loginLoading ? t("submitting") : t("submit")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-background pb-8">
      <div className="mx-auto w-full max-w-none py-6 space-y-6 xl:px-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold text-foreground">{t("dashboardTitle")}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStoredAdminToken(null)
                setUnlocked(false)
                setStats(null)
                setSessions([])
              }}
            >
              {t("logout")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => loadAll()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              {t("refresh")}
            </Button>
            <Badge
              variant="outline"
              className={
                kioskOnline
                  ? "border-success text-success"
                  : "border-destructive text-destructive"
              }
            >
              {kioskOnline ? (
                <Wifi className="h-3 w-3 mr-1" />
              ) : (
                <WifiOff className="h-3 w-3 mr-1" />
              )}
              {kioskOnline ? t("online") : t("offline")}
            </Badge>
          </div>
        </div>

        {loading && !stats ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-10 w-10" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

            <Tabs value={mainTab} onValueChange={setMainTab}>
              <TabsList className="grid h-auto w-full min-w-0 grid-cols-2 gap-1 sm:grid-cols-5">
                <TabsTrigger value="overview" className="text-xs sm:text-sm">
                  <LayoutDashboard className="h-4 w-4 mr-1 hidden sm:inline" />
                  {t("tabOverview")}
                </TabsTrigger>
                <TabsTrigger value="inventory" className="text-xs sm:text-sm">
                  <Package className="h-4 w-4 mr-1 hidden sm:inline" />
                  {t("tabInventory")}
                </TabsTrigger>
                <TabsTrigger value="logs" className="text-xs sm:text-sm">
                  <FileText className="h-4 w-4 mr-1 hidden sm:inline" />
                  {t("tabLogs")}
                </TabsTrigger>
                <TabsTrigger value="users" className="text-xs sm:text-sm">
                  <Users className="h-4 w-4 mr-1 hidden sm:inline" />
                  {t("tabUsers")}
                </TabsTrigger>
                <TabsTrigger value="hardware" className="text-xs sm:text-sm">
                  <Cpu className="h-4 w-4 mr-1 hidden sm:inline" />
                  {t("tabHardware")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("chartChatsTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent className="h-56">
                    {overview?.dailyChats?.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={overview.dailyChats}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="count"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">{t("lowStockAlertTitle")}</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setMainTab("inventory")}>
                      {t("goInventory")}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(overview?.lowStockDrugs ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">—</p>
                    ) : (
                      overview!.lowStockDrugs.map((d) => (
                        <div
                          key={d.id}
                          className="flex justify-between text-sm border-b border-border pb-2"
                        >
                          <span>
                            {d.name}{" "}
                            <span className="font-mono text-muted-foreground">
                              ({d.slotId})
                            </span>
                          </span>
                          <Badge variant={d.quantity === 0 ? "destructive" : "secondary"}>
                            {d.quantity}
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("topDrugsTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent className="h-52">
                    {overview?.topDrugsAllTime?.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={overview.topDrugsAllTime.map((r) => ({
                            name: r.drug?.name ?? "—",
                            count: r.count,
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-12} textAnchor="end" height={48} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("topDrugsEmpty")}</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="inventory" className="mt-4 space-y-3">
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setDrugEdit(null)
                      setDrugDialogOpen(true)
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t("drugAdd")}
                  </Button>
                </div>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t("inventoryTitle")}</CardTitle>
                    <p className="text-xs text-muted-foreground font-normal">
                      {t("statLowStock")}: ≤ {threshold}
                    </p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">{t("colSlot")}</TableHead>
                            <TableHead>{t("colName")}</TableHead>
                            <TableHead className="text-center">{t("colQty")}</TableHead>
                            <TableHead className="text-center">{t("colStatus")}</TableHead>
                            <TableHead className="text-right">{t("colAction")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {drugs.map((item) => {
                            const st = stockStatus(item.quantity, threshold)
                            return (
                              <TableRow key={item.id}>
                                <TableCell className="font-mono font-medium">
                                  {item.slotId}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {item.imageUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={item.imageUrl}
                                        alt={item.name}
                                        className="h-8 w-8 rounded border bg-muted object-cover"
                                      />
                                    ) : (
                                      <div className="h-8 w-8 rounded border bg-muted" />
                                    )}
                                    <span>{item.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {item.quantity}
                                </TableCell>
                                <TableCell className="text-center">
                                  {getStatusBadge(st)}
                                </TableCell>
                                <TableCell className="text-right space-x-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRestock(item)}
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    {t("restock")}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setDrugEdit(item)
                                      setDrugDialogOpen(true)
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={() => setDeleteId(item.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
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

              <TabsContent value="logs" className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-3 items-center">
                  <Input
                    className="max-w-xs"
                    placeholder={t("userSearchPh")}
                    value={logQuery}
                    onChange={(e) => setLogQuery(e.target.value)}
                  />
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={redFlagOnly}
                      onCheckedChange={(v) => setRedFlagOnly(Boolean(v))}
                    />
                    {t("redFlagFilter")}
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {t("totalLabel")}: {sessionTotal}
                  </span>
                </div>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t("logsTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("colWhen")}</TableHead>
                            <TableHead>{t("colUser")}</TableHead>
                            <TableHead>{t("colSummary")}</TableHead>
                            <TableHead>{t("colDrug")}</TableHead>
                            <TableHead className="text-center">{t("colQr")}</TableHead>
                            <TableHead className="text-center">{t("colSeverity")}</TableHead>
                            <TableHead className="text-center">{t("colMachine")}</TableHead>
                            <TableHead className="w-24" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sessions.map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell className="whitespace-nowrap text-sm">
                                {new Date(tx.date).toLocaleString(
                                  locale === "en" ? "en-GB" : "th-TH"
                                )}
                              </TableCell>
                              <TableCell className="text-sm">{tx.userLabel}</TableCell>
                              <TableCell className="text-sm max-w-[120px] truncate">
                                {tx.summary}
                              </TableCell>
                              <TableCell className="text-sm">{tx.drug}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="text-xs">
                                  {tx.pickupStatus === "NONE"
                                    ? t("pickup_NONE")
                                    : tx.pickupStatus === "QR_ISSUED"
                                      ? t("pickup_QR_ISSUED")
                                      : tx.pickupStatus === "PICKED"
                                        ? t("pickup_PICKED")
                                        : t("pickup_EXPIRED")}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  variant={
                                    tx.severity === "ESCALATE_HOSPITAL"
                                      ? "destructive"
                                      : "outline"
                                  }
                                  className="text-xs"
                                >
                                  {tx.severity === "ESCALATE_HOSPITAL"
                                    ? t("severity_ESCALATE")
                                    : t("severity_ROUTINE")}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="text-xs">
                                  {tx.machineStatus === "DISPENSED"
                                    ? t("machine_DISPENSED")
                                    : t("machine_NONE")}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => {
                                    setSessionPick(tx.id)
                                    setSessionOpen(true)
                                  }}
                                >
                                  {t("viewDetail")}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="users" className="mt-4 space-y-3">
                <Input
                  className="max-w-sm"
                  placeholder={t("userSearchPh")}
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("totalLabel")}: {userTotal}
                </p>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("colUser")}</TableHead>
                          <TableHead>{t("phoneLabel")}</TableHead>
                          <TableHead className="text-right" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-muted-foreground">
                              {t("noUsers")}
                            </TableCell>
                          </TableRow>
                        ) : (
                          userRows.map((u) => (
                            <TableRow key={u.id}>
                              <TableCell className="font-medium">{u.fullName}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {u.phone ?? "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                      setUserPick(u.id)
                                      setUserOpen(true)
                                    }}
                                  >
                                    {t("viewDetail")}
                                  </Button>
                                  {!u.isAdmin ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-destructive"
                                      onClick={() =>
                                        setDeleteUserPick({
                                          id: u.id,
                                          name: u.fullName || u.username || "—",
                                        })
                                      }
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="hardware" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Cpu className="h-5 w-5" />
                      {t("hwTitle")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Database
                          className={`h-6 w-6 ${health?.database ? "text-success" : "text-destructive"}`}
                        />
                        <div>
                          <p className="font-medium text-sm">{t("healthTitle")}</p>
                          <p className="text-xs text-muted-foreground">
                            {health?.database ? t("dbOk") : t("dbBad")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Cloud
                          className={`h-6 w-6 ${
                            health?.dify === "ok"
                              ? "text-success"
                              : health?.dify === "missing_key"
                                ? "text-muted-foreground"
                                : "text-destructive"
                          }`}
                        />
                        <div>
                          <p className="font-medium text-sm">Dify</p>
                          <p className="text-xs text-muted-foreground">
                            {health?.dify === "ok"
                              ? t("difyOk")
                              : health?.dify === "missing_key"
                                ? t("difyMissing")
                                : t("difyBad")}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        {kioskOnline ? (
                          <Wifi className="h-5 w-5 text-success" />
                        ) : (
                          <WifiOff className="h-5 w-5 text-destructive" />
                        )}
                        <div>
                          <p className="font-medium text-foreground">{t("connTitle")}</p>
                          <p className="text-sm text-muted-foreground">
                            {kioskOnline ? t("connOk") : t("connBad")}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={kioskOnline ? "default" : "destructive"}
                        className={kioskOnline ? "bg-success hover:bg-success/80" : ""}
                      >
                        {kioskOnline ? "Online" : "Offline"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" className="h-auto py-4" type="button">
                        <div className="flex flex-col items-center gap-2">
                          <Play className="h-5 w-5" />
                          <span className="text-xs">{t("testMotor")}</span>
                        </div>
                      </Button>
                      <Button variant="outline" className="h-auto py-4" type="button">
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="h-5 w-5" />
                          <span className="text-xs">{t("resetCabinet")}</span>
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

      <AdminDrugDialog
        open={drugDialogOpen}
        onOpenChange={setDrugDialogOpen}
        drug={drugEdit}
        onSaved={() => loadAll()}
      />

      <AdminSessionSheet
        sessionId={sessionPick}
        open={sessionOpen}
        onOpenChange={setSessionOpen}
        onUpdated={() => loadSessions()}
      />

      <AdminUserSheet
        userId={userPick}
        open={userOpen}
        onOpenChange={setUserOpen}
        onSaved={() => loadUsers()}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("drugDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmDeleteDrug")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>
              {t("drugDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteUserPick}
        onOpenChange={() => setDeleteUserPick(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteUser")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteUser", { name: deleteUserPick?.name ?? "—" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDeleteUser()}>
              {t("deleteUser")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
