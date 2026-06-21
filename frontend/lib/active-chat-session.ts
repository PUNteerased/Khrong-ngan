const KEY = "laneya_active_chat_session"

type StoredActiveSession = {
  sessionId: string
  userId: string
}

export function setActiveChatSession(sessionId: string, userId: string) {
  if (typeof window === "undefined") return
  const payload: StoredActiveSession = { sessionId, userId }
  localStorage.setItem(KEY, JSON.stringify(payload))
}

export function getActiveChatSession(userId: string): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredActiveSession
    if (parsed.userId !== userId) return null
    return parsed.sessionId || null
  } catch {
    return null
  }
}

export function clearActiveChatSession() {
  if (typeof window === "undefined") return
  localStorage.removeItem(KEY)
}
