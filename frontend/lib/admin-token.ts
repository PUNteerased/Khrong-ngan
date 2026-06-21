const KEY = "laneya_admin_token"

/** localStorage so admin auth works across tabs (e.g. /admin/kiosk opened in new tab). */
export function getStoredAdminToken(): string | null {
  if (typeof window === "undefined") return null
  const fromLocal = localStorage.getItem(KEY)
  if (fromLocal) return fromLocal
  const legacy = sessionStorage.getItem(KEY)
  if (legacy) {
    localStorage.setItem(KEY, legacy)
    sessionStorage.removeItem(KEY)
    return legacy
  }
  return null
}

export function setStoredAdminToken(token: string | null) {
  if (typeof window === "undefined") return
  if (token) {
    localStorage.setItem(KEY, token)
  } else {
    localStorage.removeItem(KEY)
  }
  sessionStorage.removeItem(KEY)
}
