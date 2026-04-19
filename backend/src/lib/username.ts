/** ใช้เป็นคีย์ล็อกอิน — trim + lowercase */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

/** ตัวอักษร ตัวเลข . _ - ความยาว 3–32 */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/

export function isValidUsernameNormalized(normalized: string): boolean {
  return USERNAME_PATTERN.test(normalized)
}
