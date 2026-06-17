import axios from "axios"
import { getGoogleAccessToken } from "../lib/googleServiceAccount.js"

const BANGKOK_TZ = "Asia/Bangkok"
const FOLDER_MIME = "application/vnd.google-apps.folder"

type BangkokDateTime = {
  day: string
  month: string
  yearBe2: string
  hour: string
  minute: string
  second: string
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
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

  const gregorianYear = Number(get("year"))
  const beYear2 = pad2((gregorianYear + 543) % 100)

  return {
    day: get("day"),
    month: get("month"),
    yearBe2: beYear2,
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

export async function ensureDateSubfolders(
  rootFolderId: string,
  at = new Date()
): Promise<string> {
  const accessToken = await getGoogleAccessToken()
  const { day, month, yearBe2 } = bangkokDateTime(at)

  const dayFolderId = await ensureChildFolder(accessToken, rootFolderId, day)
  const monthFolderId = await ensureChildFolder(accessToken, dayFolderId, month)
  const yearFolderId = await ensureChildFolder(accessToken, monthFolderId, yearBe2)
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
  const { hour, minute, second } = bangkokDateTime(at)
  const ext = mimeToExt(mimeType)
  const baseName = `${hour}${minute}${second}`
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

export async function appendIssueReportRow(row: IssueReportSheetRow): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID?.trim()
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_ID ไม่ได้ตั้งค่า")
  }

  const tab = process.env.ISSUE_REPORT_SHEET_TAB?.trim() || "IssueReports"
  const accessToken = await getGoogleAccessToken()
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
