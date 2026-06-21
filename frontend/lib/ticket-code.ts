/** Matches backend TICKET_CODE_RE: A1-0001-ABCDEF */
export const TICKET_CODE_RE = /^[AB][1-5]-\d{4}-[A-Z]{6}$/

const COMPACT_TICKET_RE = /^[AB][1-5]\d{4}[A-Z]{6}$/

/** Strip dashes/spaces and uppercase. */
export function stripTicketCodeInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, "")
}

/**
 * Parse compact or dashed ticket input → canonical A1-0001-ABCDEF.
 * Returns null if invalid.
 */
export function parseCompactTicketCode(raw: string): string | null {
  const compact = stripTicketCodeInput(raw)
  if (!compact) return null

  if (TICKET_CODE_RE.test(compact)) {
    return compact
  }

  if (!COMPACT_TICKET_RE.test(compact)) {
    return null
  }

  const formatted = `${compact.slice(0, 2)}-${compact.slice(2, 6)}-${compact.slice(6)}`
  return TICKET_CODE_RE.test(formatted) ? formatted : null
}

/** Display hint for compact entry (visual separators only). */
export function ticketCodeFormatHint(): string {
  return "A1 · 0001 · ABCDEF"
}
