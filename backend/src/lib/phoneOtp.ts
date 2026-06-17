import axios from "axios"

type ThaiBulkSmsRequestResult =
  | { sent: true; token: string }
  | { sent: false; skippedReason: string }

type ThaiBulkSmsVerifyResult = { verified: boolean; message?: string }

function getThaiBulkSmsConfig() {
  return {
    key: process.env.THAIBULKSMS_API_KEY?.trim(),
    secret: process.env.THAIBULKSMS_API_SECRET?.trim(),
    sender: process.env.THAIBULKSMS_SENDER?.trim() || undefined,
    baseUrl: process.env.THAIBULKSMS_BASE_URL?.trim() || "https://otp.thaibulksms.com",
  }
}

function toFormBody(data: Record<string, string>) {
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(data)) body.set(k, v)
  return body.toString()
}

function extractToken(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null
  const p = payload as Record<string, unknown>
  const direct = p.token
  if (typeof direct === "string" && direct.trim()) return direct
  const nested = p.data
  if (nested && typeof nested === "object") {
    const t = (nested as Record<string, unknown>).token
    if (typeof t === "string" && t.trim()) return t
  }
  return null
}

export async function requestPhoneOtpViaThaiBulkSms(phone: string): Promise<ThaiBulkSmsRequestResult> {
  const cfg = getThaiBulkSmsConfig()
  if (!cfg.key || !cfg.secret) {
    return { sent: false, skippedReason: "THAIBULKSMS_API_KEY or THAIBULKSMS_API_SECRET not set" }
  }

  const payload: Record<string, string> = {
    key: cfg.key,
    secret: cfg.secret,
    msisdn: phone,
  }
  if (cfg.sender) payload.sender = cfg.sender

  const res = await axios.post(`${cfg.baseUrl}/v2/otp/request`, toFormBody(payload), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 10000,
    validateStatus: () => true,
  })
  if (res.status < 200 || res.status >= 300) {
    throw new Error(
      typeof res.data?.message === "string"
        ? res.data.message
        : "ThaiBulkSMS request OTP failed"
    )
  }

  const token = extractToken(res.data)
  if (!token) {
    throw new Error("ThaiBulkSMS response missing token")
  }
  return { sent: true, token }
}

export async function verifyPhoneOtpViaThaiBulkSms(
  token: string,
  pin: string
): Promise<ThaiBulkSmsVerifyResult> {
  const cfg = getThaiBulkSmsConfig()
  if (!cfg.key || !cfg.secret) {
    return { verified: false, message: "ThaiBulkSMS not configured" }
  }

  const res = await axios.post(
    `${cfg.baseUrl}/v2/otp/verify`,
    toFormBody({
      key: cfg.key,
      secret: cfg.secret,
      token,
      pin,
    }),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 10000,
      validateStatus: () => true,
    }
  )

  if (res.status >= 200 && res.status < 300) {
    return { verified: true }
  }

  const message =
    typeof res.data?.message === "string"
      ? res.data.message
      : typeof res.data?.error === "string"
        ? res.data.error
        : "OTP ไม่ถูกต้องหรือหมดอายุ"

  return { verified: false, message }
}
