const KEY = "laneya_admin_token"

export function getStoredAdminToken(): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(KEY)
}

export function setStoredAdminToken(token: string | null) {
  if (typeof window === "undefined") return
  if (token) sessionStorage.setItem(KEY, token)
  else sessionStorage.removeItem(KEY)
}
