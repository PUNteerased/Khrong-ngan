import { JWT } from "google-auth-library"

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"

export type GoogleServiceAccountCreds = {
  clientEmail: string
  privateKey: string
}

function normalizeServiceAccountJson(raw: string): string {
  let value = raw.trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim()
  }
  return value
}

function parseServiceAccountJson(raw: string): {
  client_email?: string
  private_key?: string
} {
  const normalized = normalizeServiceAccountJson(raw)
  try {
    return JSON.parse(normalized) as {
      client_email?: string
      private_key?: string
    }
  } catch {
    // Render บางครั้งเก็บเป็น literal \n ทั้งก้อน — ลองแปลงเป็น newline จริงก่อน parse อีกครั้ง
    const unescaped = normalized.replace(/\\n/g, "\n").replace(/\\"/g, '"')
    return JSON.parse(unescaped) as {
      client_email?: string
      private_key?: string
    }
  }
}

export function loadGoogleServiceAccountCreds(): GoogleServiceAccountCreds {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()

  let clientEmail = serviceAccountEmail || ""
  let privateKey = serviceAccountPrivateKey || ""

  if (serviceAccountJson) {
    try {
      const parsed = parseServiceAccountJson(serviceAccountJson)
      clientEmail = parsed.client_email || clientEmail
      privateKey = parsed.private_key || privateKey
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON ไม่ใช่ JSON ที่ถูกต้อง")
    }
  }

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Service Account ไม่ครบ: ตั้ง GOOGLE_SERVICE_ACCOUNT_JSON หรือ GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
    )
  }

  return {
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  }
}

export function getGoogleServiceAccountEmail(): string | null {
  try {
    return loadGoogleServiceAccountCreds().clientEmail
  } catch {
    return null
  }
}

export function createGoogleJwtClient(scopes: string[] = [SHEETS_SCOPE, DRIVE_SCOPE]): JWT {
  const { clientEmail, privateKey } = loadGoogleServiceAccountCreds()
  return new JWT({
    email: clientEmail,
    key: privateKey,
    scopes,
  })
}

export async function getGoogleAccessToken(
  scopes: string[] = [SHEETS_SCOPE, DRIVE_SCOPE]
): Promise<string> {
  const client = createGoogleJwtClient(scopes)
  const tokenRes = await client.authorize()
  const accessToken = tokenRes.access_token
  if (!accessToken) {
    throw new Error("ไม่สามารถรับ access token จาก Service Account")
  }
  return accessToken
}
