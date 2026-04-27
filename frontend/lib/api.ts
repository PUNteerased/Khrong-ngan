import { getStoredToken } from "./auth-token"
import { getStoredAdminToken } from "./admin-token"

export function getApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")
  if (configured) return configured

  // Local dev convenience fallback only.
  if (typeof window !== "undefined") {
    const host = window.location.hostname
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:4000"
    }
  }

  throw new Error(
    "NEXT_PUBLIC_API_URL is not configured for this environment"
  )
}

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

export async function apiJson<T>(
  path: string,
  options: RequestInit & { auth?: boolean; adminAuth?: boolean } = {}
): Promise<T> {
  const { auth, adminAuth, headers: hdr, ...rest } = options
  const headers = new Headers(hdr)
  if (!headers.has("Content-Type") && rest.body) {
    headers.set("Content-Type", "application/json")
  }
  if (adminAuth) {
    const at = getStoredAdminToken()
    if (at) headers.set("Authorization", `Bearer ${at}`)
  } else if (auth !== false) {
    const token = getStoredToken()
    if (token) headers.set("Authorization", `Bearer ${token}`)
  }

  const res = await fetch(`${getApiBase()}${path}`, {
    ...rest,
    headers,
  })

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    let msg =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: string }).error)
        : res.statusText
    if (
      typeof data === "object" &&
      data !== null &&
      "hint" in data &&
      (data as { hint?: string }).hint
    ) {
      msg = `${msg} (${String((data as { hint: string }).hint)})`
    }
    throw new ApiError(msg || "คำขอล้มเหลว", res.status, data)
  }

  return data as T
}

// --- Auth & user ---

export type UserProfile = {
  id: string
  username: string
  email?: string
  phone: string
  isAdmin: boolean
  fullName: string
  avatarUrl: string | null
  age: number | null
  weight: number | null
  height: number | null
  gender: string | null
  allergiesText: string
  allergyKeywords?: string
  noAllergies: boolean
  diseasesText: string
  noDiseases: boolean
  currentMedications: string
}

export async function registerUser(payload: {
  username: string
  email: string
  phone?: string | null
  phoneVerifyToken?: string
  password: string
  fullName: string
  age?: number | null
  weight?: number | null
  height?: number | null
  gender?: string | null
  allergiesText?: string
  noAllergies?: boolean
  diseasesText?: string
  noDiseases?: boolean
  currentMedications?: string
}) {
  return apiJson<{ accessToken: string; user: UserProfile }>(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify(payload),
      auth: false,
    }
  )
}

export async function requestEmailOtp(email: string) {
  return apiJson<{ message: string; expiresInSec: number; devCode?: string }>(
    "/api/auth/email-otp/request",
    {
      method: "POST",
      body: JSON.stringify({ email }),
      auth: false,
    }
  )
}

export async function verifyEmailOtp(email: string, code: string) {
  return apiJson<{ message: string; verifyToken: string }>(
    "/api/auth/email-otp/verify",
    {
      method: "POST",
      body: JSON.stringify({ email, code }),
      auth: false,
    }
  )
}

export async function requestPasswordReset(username: string, email: string) {
  return apiJson<{ message: string; expiresInSec: number; devCode?: string }>(
    "/api/auth/password-reset/request",
    {
      method: "POST",
      body: JSON.stringify({ username, email }),
      auth: false,
    }
  )
}

export async function confirmPasswordReset(
  username: string,
  email: string,
  code: string,
  newPassword: string
) {
  return apiJson<{ message: string }>("/api/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ username, email, code, newPassword }),
    auth: false,
  })
}

export async function requestPhoneOtp(phone: string) {
  return apiJson<{ message: string; expiresInSec: number; devCode?: string }>(
    "/api/auth/otp/request",
    {
      method: "POST",
      body: JSON.stringify({ phone }),
      auth: false,
    }
  )
}

export async function verifyPhoneOtp(phone: string, code: string) {
  return apiJson<{ message: string; verifyToken: string }>(
    "/api/auth/otp/verify",
    {
      method: "POST",
      body: JSON.stringify({ phone, code }),
      auth: false,
    }
  )
}

export async function loginUser(username: string, password: string) {
  return apiJson<{ accessToken: string; user: UserProfile }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
      auth: false,
    }
  )
}

export async function loginWithGoogle(idToken: string) {
  return apiJson<{ accessToken: string; user: UserProfile }>(
    "/api/auth/google",
    {
      method: "POST",
      body: JSON.stringify({ idToken }),
      auth: false,
    }
  )
}

export async function fetchMe() {
  return apiJson<UserProfile>("/api/users/me")
}

export async function patchMe(
  body: Partial<
    Pick<
      UserProfile,
      | "fullName"
      | "avatarUrl"
      | "email"
      | "phone"
      | "age"
      | "weight"
      | "height"
      | "gender"
      | "allergiesText"
      | "noAllergies"
      | "diseasesText"
      | "noDiseases"
      | "currentMedications"
    >
  > & { phoneVerifyToken?: string }
) {
  return apiJson<UserProfile>("/api/users/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function requestMyPhoneOtp(phone: string) {
  return apiJson<{ message: string; expiresInSec: number; devCode?: string }>(
    "/api/users/me/phone-otp/request",
    {
      method: "POST",
      body: JSON.stringify({ phone }),
    }
  )
}

export async function verifyMyPhoneOtp(phone: string, code: string) {
  return apiJson<{ message: string; verifyToken: string }>(
    "/api/users/me/phone-otp/verify",
    {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    }
  )
}

export async function changeMyPassword(currentPassword: string, newPassword: string) {
  return apiJson<{ message: string }>("/api/users/me/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export async function deleteMe() {
  await apiJson<unknown>("/api/users/me", {
    method: "DELETE",
  })
}

// --- Drugs ---

export type DrugDto = {
  id: string
  name: string
  description: string
  slotId: string
  quantity: number
  category: string | null
  dosageNotes: string | null
  warnings: string | null
  ingredientsText: string
  imageUrl: string | null
  expiresAt: string | null
  priceCents: number | null
  inCabinet: boolean
}

export type DrugSafetyCheckDto = {
  drugId: string
  drugName: string
  ingredientsText: string
  isSafe: boolean
  matchedAllergies: string[]
  checkedAllergies: string[]
  checkedIngredients: string[]
}

export async function fetchDrugSafetyCheck(id: string) {
  return apiJson<DrugSafetyCheckDto>(
    `/api/drugs/${encodeURIComponent(id)}/safety-check`,
    { auth: true }
  )
}

export async function fetchDrugs(search?: string) {
  const q = search ? `?search=${encodeURIComponent(search)}` : ""
  const raw = await apiJson<unknown>(`/api/drugs${q}`, { auth: false })
  return Array.isArray(raw) ? (raw as DrugDto[]) : []
}

export async function createDrug(body: {
  name: string
  description: string
  slotId: string
  quantity?: number
  category?: string | null
  dosageNotes?: string | null
  warnings?: string | null
  ingredientsText?: string
  imageUrl?: string | null
  expiresAt?: string | null
  priceCents?: number | null
}) {
  return apiJson<DrugDto>("/api/drugs", {
    method: "POST",
    body: JSON.stringify(body),
    auth: false,
    adminAuth: true,
  })
}

export async function patchDrug(
  id: string,
  body: Partial<{
    name: string
    description: string
    slotId: string
    quantity: number
    category: string | null
    dosageNotes: string | null
    warnings: string | null
    ingredientsText: string
    imageUrl: string | null
    expiresAt: string | null
    priceCents: number | null
  }>
) {
  return apiJson<DrugDto>(`/api/drugs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    auth: false,
    adminAuth: true,
  })
}

export async function deleteDrug(id: string) {
  await apiJson<unknown>(`/api/drugs/${encodeURIComponent(id)}`, {
    method: "DELETE",
    auth: false,
    adminAuth: true,
  })
}

export async function restockDrug(id: string, add: number) {
  return apiJson<DrugDto>(`/api/drugs/${id}/restock`, {
    method: "PATCH",
    body: JSON.stringify({ add }),
    auth: false,
    adminAuth: true,
  })
}

export async function adminLogin(username: string, password: string) {
  return apiJson<{ accessToken: string }>("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
    auth: false,
  })
}

// --- Admin ---

export type AdminStats = {
  newUsersToday: number
  activeUsersToday: number
  chatsToday: number
  dispensedToday: number
  lowStockDrugCount: number
  emptyStockDrugCount: number
  redFlagsToday: number
  lowStockThreshold: number
}

export async function fetchAdminStats() {
  const raw = await apiJson<unknown>("/api/admin/stats", {
    auth: false,
    adminAuth: true,
  })
  return normalizeAdminStatsPayload(raw)
}

export type AdminHealth = {
  database: boolean
  dify: "ok" | "missing_key" | "error"
  timestamp: string
}

export async function fetchAdminHealth() {
  return apiJson<AdminHealth>("/api/admin/health", {
    auth: false,
    adminAuth: true,
  })
}

export type AdminOverview = {
  lowStockDrugs: { id: string; name: string; slotId: string; quantity: number }[]
  dailyChats: { date: string; count: number }[]
  topDrugsAllTime: TopDrugRow[]
}

export async function fetchAdminOverview() {
  const raw = await apiJson<unknown>("/api/admin/overview", {
    auth: false,
    adminAuth: true,
  })
  return normalizeAdminOverviewPayload(raw)
}

export type AdminSessionRow = {
  id: string
  date: string
  userId: string
  userLabel: string
  summary: string
  drug: string
  pickupStatus: "NONE" | "QR_ISSUED" | "PICKED" | "EXPIRED"
  severity: "ROUTINE" | "ESCALATE_HOSPITAL"
  machineStatus: "NONE" | "DISPENSED"
}

export async function fetchAdminSessions(params?: {
  q?: string
  redFlagOnly?: boolean
  limit?: number
  skip?: number
}) {
  const sp = new URLSearchParams()
  if (params?.q) sp.set("q", params.q)
  if (params?.redFlagOnly) sp.set("redFlagOnly", "true")
  if (params?.limit != null) sp.set("limit", String(params.limit))
  if (params?.skip != null) sp.set("skip", String(params.skip))
  const qs = sp.toString()
  const raw = await apiJson<unknown>(`/api/admin/sessions${qs ? `?${qs}` : ""}`, {
    auth: false,
    adminAuth: true,
  })
  return normalizeAdminSessionsPayload(raw)
}

export type AdminSessionDetail = {
  id: string
  createdAt: string
  updatedAt: string
  pickupStatus: AdminSessionRow["pickupStatus"]
  severity: AdminSessionRow["severity"]
  redFlagReason: string | null
  summary: string | null
  difyConversationId: string | null
  recommendedDrug: DrugDto | null
  userProfileSnapshot: unknown
  userCurrent: {
    id: string
    username: string
    phone: string | null
    fullName: string
    age: number | null
    weight: number | null
    allergiesText: string
    noAllergies: boolean
    diseasesText: string
    noDiseases: boolean
  }
  messages: ChatHistoryMessage[]
  adminReview: {
    id: string
    rating: "UP" | "DOWN"
    note: string | null
  } | null
}

export async function fetchAdminSessionDetail(sessionId: string) {
  return apiJson<AdminSessionDetail>(
    `/api/admin/sessions/${encodeURIComponent(sessionId)}`,
    { auth: false, adminAuth: true }
  )
}

export async function postAdminSessionFeedback(
  sessionId: string,
  body: { rating: "UP" | "DOWN"; note?: string }
) {
  return apiJson<{ id: string; rating: string; note: string | null }>(
    `/api/admin/sessions/${encodeURIComponent(sessionId)}/feedback`,
    {
      method: "POST",
      body: JSON.stringify(body),
      auth: false,
      adminAuth: true,
    }
  )
}

export type AdminUserRow = {
  id: string
  username: string
  email?: string | null
  phone: string | null
  fullName: string
  age: number | null
  weight: number | null
  allergiesText: string
  noAllergies: boolean
  diseasesText: string
  noDiseases: boolean
  isAdmin: boolean
  createdAt: string
  updatedAt: string
}

export async function fetchAdminUsers(params?: {
  query?: string
  limit?: number
  skip?: number
}) {
  const sp = new URLSearchParams()
  if (params?.query) sp.set("query", params.query)
  if (params?.limit != null) sp.set("limit", String(params.limit))
  if (params?.skip != null) sp.set("skip", String(params.skip))
  const qs = sp.toString()
  const raw = await apiJson<unknown>(`/api/admin/users${qs ? `?${qs}` : ""}`, {
    auth: false,
    adminAuth: true,
  })
  return normalizeAdminUsersPayload(raw)
}

export async function fetchAdminUser(id: string) {
  return apiJson<{
    user: AdminUserRow
    recentSessions: {
      id: string
      createdAt: string
      summary: string | null
      pickupStatus: string
      severity: string
      recommendedDrug: { id: string; name: string; slotId: string } | null
    }[]
    medicationHistory: {
      id: string
      createdAt: string
      pickupStatus: string
      recommendedDrug: { id: string; name: string; slotId: string } | null
    }[]
  }>(`/api/admin/users/${encodeURIComponent(id)}`, { auth: false, adminAuth: true })
}

export async function patchAdminUser(
  id: string,
  body: Partial<{
    phone: string | null
    fullName: string
    age: number | null
    weight: number | null
    allergiesText: string
    noAllergies: boolean
    diseasesText: string
    noDiseases: boolean
  }>
) {
  return apiJson<AdminUserRow>(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    auth: false,
    adminAuth: true,
  })
}

export async function deleteAdminUser(id: string) {
  await apiJson<unknown>(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
    auth: false,
    adminAuth: true,
  })
}

export type TopDrugRow = { drug: DrugDto | null; count: number }

export async function fetchTopDrugs() {
  const raw = await apiJson<unknown>("/api/admin/top-drugs", {
    auth: false,
    adminAuth: true,
  })
  return Array.isArray(raw) ? (raw as TopDrugRow[]) : []
}

// --- Chat history (ผู้ใช้) ---

export type ChatSessionListItem = {
  id: string
  createdAt: string
  updatedAt: string
  summary: string | null
  preview: string
  messageCount: number
}

export async function fetchChatSessions() {
  return apiJson<ChatSessionListItem[]>("/api/chat/sessions")
}

export type ChatHistoryMessage = {
  id: string
  role: string
  content: string
  imageUrl: string | null
  createdAt: string
}

export async function fetchChatSessionMessages(sessionId: string) {
  return apiJson<{
    sessionId: string
    createdAt: string
    messages: ChatHistoryMessage[]
  }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`)
}

// --- Chat ---

export type ChatResponse = {
  answer: string
  sessionId: string
  conversationId: string | null
  safetyCheck?: {
    mentionedDrugIds: string[]
    warnings: {
      drugId: string
      drugName: string
      matchedAllergies: string[]
      checkedIngredients: string[]
    }[]
    firstUnsafeDrugId: string | null
  }
  profile?: {
    missingFields: string[]
    missingCritical: string[]
    askedInChat: boolean
    autoSavedFields?: string[]
  }
}

export async function sendChatMessage(
  userMessage: string,
  sessionId?: string | null,
  imageUrl?: string | null
) {
  return apiJson<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      userMessage,
      sessionId: sessionId || undefined,
      imageUrl: imageUrl || undefined,
    }),
  })
}

function adminNum(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** Backend ใหม่คืน `{ items, total }` — รุ่นเก่าคืนเป็น array ตรง ๆ */
function normalizeAdminSessionsPayload(raw: unknown): {
  items: AdminSessionRow[]
  total: number
} {
  if (Array.isArray(raw)) {
    const items = raw.map(normalizeAdminSessionRow)
    return { items, total: items.length }
  }
  if (raw && typeof raw === "object" && "items" in raw) {
    const o = raw as { items?: unknown; total?: unknown }
    const items = Array.isArray(o.items)
      ? o.items.map(normalizeAdminSessionRow)
      : []
    const total = typeof o.total === "number" ? o.total : items.length
    return { items, total }
  }
  return { items: [], total: 0 }
}

function normalizeAdminSessionRow(row: unknown): AdminSessionRow {
  const r = row as Record<string, unknown>
  const ps = r.pickupStatus
  const pickup =
    typeof ps === "string" &&
    ["NONE", "QR_ISSUED", "PICKED", "EXPIRED"].includes(ps)
      ? (ps as AdminSessionRow["pickupStatus"])
      : "NONE"
  const sev = r.severity
  const severity =
    sev === "ESCALATE_HOSPITAL"
      ? "ESCALATE_HOSPITAL"
      : ("ROUTINE" as AdminSessionRow["severity"])
  const ms = r.machineStatus
  const machineStatus: AdminSessionRow["machineStatus"] =
    ms === "DISPENSED" ||
    pickup === "PICKED" ||
    ms === "จ่ายสำเร็จ" ||
    (typeof ms === "string" && ms.includes("จ่าย"))
      ? "DISPENSED"
      : "NONE"
  return {
    id: String(r.id ?? ""),
    date: String(r.date ?? ""),
    userId: String(r.userId ?? ""),
    userLabel: String(r.userLabel ?? "—"),
    summary: String(r.summary ?? "—"),
    drug: String(r.drug ?? "—"),
    pickupStatus: pickup,
    severity,
    machineStatus,
  }
}

function normalizeAdminUsersPayload(raw: unknown): {
  items: AdminUserRow[]
  total: number
} {
  if (Array.isArray(raw)) {
    return { items: raw as AdminUserRow[], total: raw.length }
  }
  if (raw && typeof raw === "object" && "items" in raw) {
    const o = raw as { items?: unknown; total?: unknown }
    const items = Array.isArray(o.items) ? (o.items as AdminUserRow[]) : []
    const total = typeof o.total === "number" ? o.total : items.length
    return { items, total }
  }
  return { items: [], total: 0 }
}

function normalizeAdminOverviewPayload(raw: unknown): AdminOverview {
  if (!raw || typeof raw !== "object") {
    return { lowStockDrugs: [], dailyChats: [], topDrugsAllTime: [] }
  }
  const o = raw as Partial<AdminOverview>
  return {
    lowStockDrugs: Array.isArray(o.lowStockDrugs) ? o.lowStockDrugs : [],
    dailyChats: Array.isArray(o.dailyChats) ? o.dailyChats : [],
    topDrugsAllTime: Array.isArray(o.topDrugsAllTime) ? o.topDrugsAllTime : [],
  }
}

/** รองรับสเกมา stats เก่า (usersToday / alerts) */
function normalizeAdminStatsPayload(raw: unknown): AdminStats {
  if (!raw || typeof raw !== "object") {
    return {
      newUsersToday: 0,
      activeUsersToday: 0,
      chatsToday: 0,
      dispensedToday: 0,
      lowStockDrugCount: 0,
      emptyStockDrugCount: 0,
      redFlagsToday: 0,
      lowStockThreshold: 5,
    }
  }
  const o = raw as Record<string, unknown>
  if (
    typeof o.lowStockDrugCount === "number" &&
    typeof o.activeUsersToday === "number"
  ) {
    return raw as AdminStats
  }
  return {
    newUsersToday: adminNum(o.newUsersToday ?? o.usersToday),
    activeUsersToday: adminNum(o.activeUsersToday),
    chatsToday: adminNum(o.chatsToday),
    dispensedToday: adminNum(o.dispensedToday),
    lowStockDrugCount: adminNum(o.lowStockDrugCount ?? o.alerts),
    emptyStockDrugCount: adminNum(o.emptyStockDrugCount),
    redFlagsToday: adminNum(o.redFlagsToday),
    lowStockThreshold: adminNum(o.lowStockThreshold, 5) || 5,
  }
}
