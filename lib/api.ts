import { getStoredToken } from "./auth-token"
import { getStoredAdminToken } from "./admin-token"

export function getApiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:4000"
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
  phone: string
  isAdmin: boolean
  fullName: string
  age: number | null
  weight: number | null
  allergiesText: string
  noAllergies: boolean
  diseasesText: string
  noDiseases: boolean
}

export async function registerUser(payload: {
  username: string
  phone?: string
  password: string
  fullName: string
  age?: number | null
  weight?: number | null
  allergiesText?: string
  noAllergies?: boolean
  diseasesText?: string
  noDiseases?: boolean
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

export async function fetchMe() {
  return apiJson<UserProfile>("/api/users/me")
}

export async function patchMe(
  body: Partial<
    Pick<
      UserProfile,
      | "fullName"
      | "age"
      | "weight"
      | "allergiesText"
      | "noAllergies"
      | "diseasesText"
      | "noDiseases"
    >
  >
) {
  return apiJson<UserProfile>("/api/users/me", {
    method: "PATCH",
    body: JSON.stringify(body),
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
  inCabinet: boolean
}

export async function fetchDrugs(search?: string) {
  const q = search ? `?search=${encodeURIComponent(search)}` : ""
  return apiJson<DrugDto[]>(`/api/drugs${q}`, { auth: false })
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
  usersToday: number
  dispensedToday: number
  alerts: number
  chatsToday: number
}

export async function fetchAdminStats() {
  return apiJson<AdminStats>("/api/admin/stats", {
    auth: false,
    adminAuth: true,
  })
}

export type AdminSessionRow = {
  id: string
  date: string
  userLabel: string
  summary: string
  drug: string
  pickupStatus: string
  qrStatus: string
  machineStatus: string
}

export async function fetchAdminSessions() {
  return apiJson<AdminSessionRow[]>("/api/admin/sessions", {
    auth: false,
    adminAuth: true,
  })
}

export type TopDrugRow = { drug: DrugDto | null; count: number }

export async function fetchTopDrugs() {
  return apiJson<TopDrugRow[]>("/api/admin/top-drugs", {
    auth: false,
    adminAuth: true,
  })
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

export async function sendChatMessage(userMessage: string, sessionId?: string | null) {
  return apiJson<{
    answer: string
    sessionId: string
    conversationId: string
  }>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ userMessage, sessionId: sessionId || undefined }),
  })
}
