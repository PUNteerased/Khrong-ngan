import axios from "axios"
import { getGoogleAccessToken, getGoogleServiceAccountEmail } from "../lib/googleServiceAccount.js"

const BANGKOK_TZ = "Asia/Bangkok"
const FOLDER_MIME = "application/vnd.google-apps.folder"

type BangkokDateTime = {
  day: string
  month: string
  yearCe: string
  hour: string
  minute: string
  second: string
}

function bangkokDateTime(at = new Date()): BangkokDateTime {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  const parts = fmt.formatToParts(at)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00"

  const gregorianYear = get("year")

  return {
    day: get("day"),
    month: get("month"),
    yearCe: gregorianYear,
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  }
}

function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
  }
  return map[mimeType.toLowerCase()] || "jpg"
}

async function driveRequest<T>(
  method: "GET" | "POST",
  path: string,
  accessToken: string,
  data?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const url = path.startsWith("http") ? path : `https://www.googleapis.com/drive/v3${path}`
  const res = await axios.request<T>({
    method,
    url,
    data,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...headers,
    },
    timeout: 30000,
  })
  return res.data
}

async function findChildFolder(
  accessToken: string,
  parentId: string,
  name: string
): Promise<string | null> {
  const q = `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='${FOLDER_MIME}' and trashed=false`
  const data = await driveRequest<{ files?: { id: string }[] }>(
    "GET",
    `/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    accessToken
  )
  return data.files?.[0]?.id ?? null
}

async function createFolder(
  accessToken: string,
  parentId: string,
  name: string
): Promise<string> {
  const data = await driveRequest<{ id: string }>(
    "POST",
    "/files?fields=id&supportsAllDrives=true",
    accessToken,
    {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    },
    { "Content-Type": "application/json" }
  )
  if (!data.id) throw new Error(`สร้างโฟลเดอร์ Drive "${name}" ไม่สำเร็จ`)
  return data.id
}

async function ensureChildFolder(
  accessToken: string,
  parentId: string,
  name: string
): Promise<string> {
  const existing = await findChildFolder(accessToken, parentId, name)
  if (existing) return existing
  return createFolder(accessToken, parentId, name)
}

/** โฟลเดอร์ย่อยตามวันที่ (เวลา Bangkok): DD/MM/YYYY ค.ศ. เช่น 18/06/2026 */
export async function ensureDateSubfolders(
  rootFolderId: string,
  at = new Date()
): Promise<string> {
  const accessToken = await getGoogleAccessToken()
  const { day, month, yearCe } = bangkokDateTime(at)

  const dayFolderId = await ensureChildFolder(accessToken, rootFolderId, day)
  const monthFolderId = await ensureChildFolder(accessToken, dayFolderId, month)
  const yearFolderId = await ensureChildFolder(accessToken, monthFolderId, yearCe)
  return yearFolderId
}

async function fileExistsInFolder(
  accessToken: string,
  folderId: string,
  name: string
): Promise<boolean> {
  const q = `'${folderId}' in parents and name='${name.replace(/'/g, "\\'")}' and trashed=false`
  const data = await driveRequest<{ files?: { id: string }[] }>(
    "GET",
    `/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    accessToken
  )
  return (data.files?.length ?? 0) > 0
}

async function pickUniqueFilename(
  accessToken: string,
  folderId: string,
  baseName: string,
  ext: string
): Promise<string> {
  let candidate = `${baseName}.${ext}`
  let suffix = 0
  while (await fileExistsInFolder(accessToken, folderId, candidate)) {
    suffix += 1
    candidate = `${baseName}_${suffix}.${ext}`
  }
  return candidate
}

export async function uploadIssueImage(
  file: Buffer,
  mimeType: string,
  at = new Date()
): Promise<string> {
  const rootFolderId = process.env.GOOGLE_DRIVE_ISSUE_FOLDER_ID?.trim()
  if (!rootFolderId) {
    throw new Error("GOOGLE_DRIVE_ISSUE_FOLDER_ID ไม่ได้ตั้งค่า")
  }

  const accessToken = await getGoogleAccessToken()
  const leafFolderId = await ensureDateSubfolders(rootFolderId, at)
  const { hour, minute } = bangkokDateTime(at)
  const ext = mimeToExt(mimeType)
  const baseName = `${hour}${minute}`
  const filename = await pickUniqueFilename(accessToken, leafFolderId, baseName, ext)

  const metadata = JSON.stringify({
    name: filename,
    parents: [leafFolderId],
  })

  const boundary = `laneya_issue_${Date.now()}`
  const preamble = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
  const closing = `\r\n--${boundary}--`
  const body = Buffer.concat([
    Buffer.from(preamble, "utf8"),
    file,
    Buffer.from(closing, "utf8"),
  ])

  const { data } = await axios.post<{
    id?: string
    webViewLink?: string
  }>(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true",
    body,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      timeout: 60000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    }
  )

  if (data.webViewLink) return data.webViewLink
  if (data.id) return `https://drive.google.com/file/d/${data.id}/view`
  throw new Error("อัปโหลดรูปไป Google Drive ไม่สำเร็จ")
}

export type IssueReportSheetRow = {
  id: string
  createdAt: string
  category: string
  description: string
  reporterEmail: string
  imageUrl: string | null
  reporterName: string
  reporterUsername: string
  userId: string | null
  status: string
}

const ISSUE_REPORT_HEADERS = [
  "id",
  "created_at",
  "category",
  "description",
  "reporter_email",
  "image_url",
  "reporter_name",
  "reporter_username",
  "user_id",
  "status",
] as const

const readySheetKeys = new Set<string>()

function googleApiErrorMessage(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null
  const data = err.response?.data as
    | { error?: { message?: string; status?: string } }
    | undefined
  return data?.error?.message ?? null
}

export function formatIssueReportGoogleError(err: unknown): string {
  const apiMsg = googleApiErrorMessage(err)
  const status = axios.isAxiosError(err) ? err.response?.status : undefined
  const sheetId = process.env.GOOGLE_SHEETS_ID?.trim() || "(ไม่ได้ตั้งค่า)"
  const saEmail = getGoogleServiceAccountEmail() || "(ไม่พบ Service Account)"
  const shareHint = `แชร์ Sheet ${sheetId} ให้ ${saEmail} เป็น Editor`

  if (status === 403 || apiMsg?.toLowerCase().includes("permission")) {
    const detail = apiMsg ? ` (${apiMsg})` : ""
    return `บันทึกรายงานแล้ว แต่ซิงก์ Google Sheet ไม่สำเร็จ — ${shareHint}${detail}`
  }
  if (status === 404 || apiMsg?.toLowerCase().includes("not found")) {
    return "บันทึกรายงานแล้ว แต่ซิงก์ Google Sheet ไม่สำเร็จ — ตรวจสอบ GOOGLE_SHEETS_ID บน Render"
  }
  if (apiMsg?.toLowerCase().includes("unable to parse range")) {
    return "บันทึกรายงานแล้ว แต่ซิงก์ Google Sheet ไม่สำเร็จ — ไม่พบแท็บ IssueReports (ระบบจะสร้างให้อัตโนมัติหลัง deploy ล่าสุด)"
  }
  if (apiMsg) {
    return `บันทึกรายงานแล้ว แต่ซิงก์ Google Sheet ไม่สำเร็จ — ${apiMsg}`
  }
  if (err instanceof Error && err.message) {
    return `บันทึกรายงานแล้ว แต่ซิงก์ Google Sheet ไม่สำเร็จ — ${err.message}`
  }
  return "บันทึกรายงานแล้ว แต่ซิงก์ Google Sheet ไม่สำเร็จ — ตรวจสอบ GOOGLE_SHEETS_ID และสิทธิ์ Service Account"
}

async function sheetsRequest<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  accessToken: string,
  data?: unknown
): Promise<T> {
  const url = path.startsWith("http")
    ? path
    : `https://sheets.googleapis.com/v4/spreadsheets/${path}`
  const res = await axios.request<T>({
    method,
    url,
    data,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    timeout: 20000,
  })
  return res.data
}

async function ensureIssueReportSheetReady(
  spreadsheetId: string,
  tab: string,
  accessToken: string
): Promise<void> {
  const cacheKey = `${spreadsheetId}:${tab}`
  if (readySheetKeys.has(cacheKey)) return

  const meta = await sheetsRequest<{
    sheets?: { properties?: { title?: string } }[]
  }>(
    "GET",
    `${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
    accessToken
  )

  const titles = new Set(
    (meta.sheets ?? [])
      .map((sheet) => sheet.properties?.title?.trim())
      .filter((title): title is string => Boolean(title))
  )

  if (!titles.has(tab)) {
    await sheetsRequest(
      "POST",
      `${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      accessToken,
      {
        requests: [{ addSheet: { properties: { title: tab } } }],
      }
    )
  }

  const headerRange = `${tab}!A1:J1`
  const headerData = await sheetsRequest<{ values?: string[][] }>(
    "GET",
    `${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(headerRange)}`,
    accessToken
  )

  const firstCell = headerData.values?.[0]?.[0]?.trim() ?? ""
  if (firstCell !== ISSUE_REPORT_HEADERS[0]) {
    await sheetsRequest(
      "PUT",
      `${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(
        headerRange
      )}?valueInputOption=USER_ENTERED`,
      accessToken,
      { values: [Array.from(ISSUE_REPORT_HEADERS)] }
    )
  }

  readySheetKeys.add(cacheKey)
}

/** ทดสอบว่า Service Account เข้าถึง spreadsheet ได้หรือไม่ */
export async function probeIssueReportGoogleAccess(): Promise<{
  ok: boolean
  serviceAccountEmail: string | null
  spreadsheetId: string | null
  tab: string
  error: string | null
}> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID?.trim() || null
  const tab = process.env.ISSUE_REPORT_SHEET_TAB?.trim() || "IssueReports"
  const serviceAccountEmail = getGoogleServiceAccountEmail()

  if (!spreadsheetId) {
    return {
      ok: false,
      serviceAccountEmail,
      spreadsheetId,
      tab,
      error: "GOOGLE_SHEETS_ID ไม่ได้ตั้งค่า",
    }
  }
  if (!serviceAccountEmail) {
    return {
      ok: false,
      serviceAccountEmail,
      spreadsheetId,
      tab,
      error: "Service Account ไม่ครบ — ตั้ง GOOGLE_SERVICE_ACCOUNT_JSON",
    }
  }

  try {
    const accessToken = await getGoogleAccessToken()
    await sheetsRequest<{ sheets?: { properties?: { title?: string } }[] }>(
      "GET",
      `${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties.title`,
      accessToken
    )
    return { ok: true, serviceAccountEmail, spreadsheetId, tab, error: null }
  } catch (err) {
    return {
      ok: false,
      serviceAccountEmail,
      spreadsheetId,
      tab,
      error: formatIssueReportGoogleError(err),
    }
  }
}

export async function appendIssueReportRow(row: IssueReportSheetRow): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID?.trim()
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_ID ไม่ได้ตั้งค่า")
  }

  const tab = process.env.ISSUE_REPORT_SHEET_TAB?.trim() || "IssueReports"
  const accessToken = await getGoogleAccessToken()
  await ensureIssueReportSheetReady(spreadsheetId, tab, accessToken)

  const range = `${tab}!A:J`
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

  await axios.post(
    url,
    {
      values: [
        [
          row.id,
          row.createdAt,
          row.category,
          row.description,
          row.reporterEmail,
          row.imageUrl ?? "",
          row.reporterName,
          row.reporterUsername,
          row.userId ?? "",
          row.status,
        ],
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    }
  )
}
