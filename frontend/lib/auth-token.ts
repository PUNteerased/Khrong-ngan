const KEY = "laneya_token"

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(KEY)
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return
  const prev = localStorage.getItem(KEY)
  if (token) localStorage.setItem(KEY, token)
  else localStorage.removeItem(KEY)
  const next = token ?? null
  if (prev !== next) {
    window.dispatchEvent(new Event("laneya-auth"))
  }
}
