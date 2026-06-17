/** ตรงกับ backend — trim + lowercase */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/
