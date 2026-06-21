/** Matches backend TICKET_CODE_RE: A1-0001-ABCDEF */
export const TICKET_CODE_RE = /^[AB][1-5]-\d{4}-[A-Z]{6}$/

const COMPACT_TICKET_RE = /^[AB][1-5]\d{4}[A-Z]{6}$/

/** Strip dashes/spaces and uppercase. */
export function stripTicketCodeInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, "")
}

/** Live format while typing: a10001abcdef → A1-0001-ABCDEF */
export function formatTicketCodeLive(raw: string): string {
  const compact = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12)
  if (compact.length <= 2) return compact
  if (compact.length <= 6) return `${compact.slice(0, 2)}-${compact.slice(2)}`
  return `${compact.slice(0, 2)}-${compact.slice(2, 6)}-${compact.slice(6)}`
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
