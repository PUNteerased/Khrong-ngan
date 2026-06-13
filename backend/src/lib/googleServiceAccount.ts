import { JWT } from "google-auth-library"

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"

export type GoogleServiceAccountCreds = {
  clientEmail: string
  privateKey: string
}

export function loadGoogleServiceAccountCreds(): GoogleServiceAccountCreds {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()

  let clientEmail = serviceAccountEmail || ""
  let privateKey = serviceAccountPrivateKey || ""

  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson) as {
        client_email?: string
        private_key?: string
      }
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
