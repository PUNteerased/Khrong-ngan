import axios from "axios"
import { JWT } from "google-auth-library"
import { prisma } from "../lib/prisma.js"

const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSH7ovQx_3n4n_-e5chogXtbMg9__BmBmT11Vvv58XYJWbe7v4YrImkatKEv6jaT9oTjS6Pt_W-8--h/pubhtml"

type ParsedCsvRow = Record<string, string>

type DiffCounters = {
  inserted: number
  updated: number
  deleted: number
  skipped: number
}

export type SyncRowError = {
  tab: string
  rowNumber: number
  message: string
  row: ParsedCsvRow
}

export type KnowledgeSyncResult = {
  source: "google_sheets_api" | "published_csv"
  sheetUrl: string
  tabs: string[]
  dryRun: boolean
  deleteMode: "soft" | "hard"
  disease: DiffCounters
  symptom: DiffCounters
  drug: DiffCounters
  healthTip: DiffCounters
  healthTipRef: DiffCounters
  i18nUi: DiffCounters
  diseaseSymptomMap: DiffCounters
  diseaseDrugMap: DiffCounters
  symptomDrugMap: DiffCounters
  errors: SyncRowError[]
}

function parseCsv(text: string): ParsedCsvRow[] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ""
  let i = 0
  let inQuotes = false
  while (i < text.length) {
    const c = text[i]
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"'
        i += 2
        continue
      }
      inQuotes = !inQuotes
      i += 1
      continue
    }
    if (!inQuotes && c === ",") {
      row.push(cur.trim())
      cur = ""
      i += 1
      continue
    }
    if (!inQuotes && (c === "\n" || c === "\r")) {
      if (c === "\r" && text[i + 1] === "\n") i += 1
      row.push(cur.trim())
      cur = ""
      if (row.some((v) => v !== "")) rows.push(row)
      row = []
      i += 1
      continue
    }
    cur += c
    i += 1
  }
  row.push(cur.trim())
  if (row.some((v) => v !== "")) rows.push(row)
  if (rows.length === 0) return []
  const header = rows[0].map((h) => h.trim().toLowerCase())
  return rows.slice(1).map((cells) => {
    const out: ParsedCsvRow = {}
    header.forEach((h, idx) => {
      out[h] = (cells[idx] ?? "").trim()
    })
    return out
  })
}

function toBool(v: string): boolean {
  return ["1", "true", "yes", "y"].includes(v.trim().toLowerCase())
}

function toInt(v: string, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function isNumericString(v: string): boolean {
  const t = String(v ?? "").trim()
  if (!t) return false
  return Number.isFinite(Number(t))
}

function normalizeSlug(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9ก-๙-_]/g, "")
}

function normalizeRefKey(v: string): string {
  return String(v ?? "").trim().toLowerCase()
}

function hasAnyValue(row: ParsedCsvRow): boolean {
  return Object.values(row).some((v) => String(v).trim())
}

function isValidUnifiedMappingsShape(rows: ParsedCsvRow[]): boolean {
  const first = rows.find(hasAnyValue)
  if (!first) return false
  const keys = Object.keys(first)
  const hasMapType = keys.includes("map_type") || keys.includes("type")
  const hasLeft = keys.includes("left_ref") || keys.includes("left_slug") || keys.includes("disease_slug") || keys.includes("symptom_slug")
  const hasRight = keys.includes("right_ref") || keys.includes("right_slug") || keys.includes("drug_ref") || keys.includes("symptom_slug")
  return hasMapType && hasLeft && hasRight
}

function hasKeyCI(row: ParsedCsvRow, key: string): boolean {
  const target = key.trim().toLowerCase()
  return Object.keys(row).some((k) => k.trim().toLowerCase() === target)
}

function detectSheetType(rows: ParsedCsvRow[]): "empty" | "drug" | "disease" | "symptom" | "mapping" | "unknown" {
  const first = rows.find(hasAnyValue)
  if (!first) return "empty"
  if (hasKeyCI(first, "drug_ref")) return "drug"
  if (hasKeyCI(first, "observation_guide") || hasKeyCI(first, "danger_level")) return "symptom"
  if (hasKeyCI(first, "severity_level") || hasKeyCI(first, "self_care_advice")) return "disease"
  if (isValidUnifiedMappingsShape(rows)) return "mapping"
  if (hasKeyCI(first, "slug") && hasKeyCI(first, "name_th")) return "disease"
  return "unknown"
}

function isHealthTipShape(rows: ParsedCsvRow[]): boolean {
  const first = rows.find(hasAnyValue)
  if (!first) return false
  return hasKeyCI(first, "title_th") || hasKeyCI(first, "summary_th") || hasKeyCI(first, "content_md_th")
}

function isHealthTipRefShape(rows: ParsedCsvRow[]): boolean {
  const first = rows.find(hasAnyValue)
  if (!first) return false
  return hasKeyCI(first, "tip_slug") || hasKeyCI(first, "ref_url") || hasKeyCI(first, "ref_title")
}

function isI18nUiShape(rows: ParsedCsvRow[]): boolean {
  const first = rows.find(hasAnyValue)
  if (!first) return false
  return hasKeyCI(first, "namespace") && hasKeyCI(first, "key") && hasKeyCI(first, "th")
}

function firstRowKeysPreview(rows: ParsedCsvRow[]): string {
  const first = rows.find(hasAnyValue)
  if (!first) return "(no rows)"
  return Object.keys(first)
    .slice(0, 12)
    .map((k) => k.trim())
    .join(",")
}

async function fetchPublishedSheetWithFallback(
  sheetUrl: string,
  preferredName: string,
  gid?: string
): Promise<ParsedCsvRow[]> {
  // 1) gid (if available)
  if (gid) {
    const rows = await fetchCsvTabRows(sheetUrl, gid)
    if (rows.length) return rows
  }
  // 2) exact name
  let rows = await fetchCsvSheetRows(sheetUrl, preferredName).catch(() => [])
  if (rows.length) return rows
  // 3) case/trim variants (handles accidental spaces/case)
  const variants = Array.from(
    new Set([
      preferredName,
      preferredName.trim(),
      preferredName.toLowerCase(),
      preferredName.toUpperCase(),
      `${preferredName.trim()} `,
      ` ${preferredName.trim()}`,
    ])
  )
  for (const v of variants) {
    rows = await fetchCsvSheetRows(sheetUrl, v).catch(() => [])
    if (rows.length) return rows
  }
  return []
}

async function getPublishedTabs(sheetUrl: string): Promise<Map<string, string>> {
  const { data } = await axios.get<string>(sheetUrl, { timeout: 15000 })
  const html = String(data)
  const map = new Map<string, string>()
  const rgx = /<a[^>]*href="[^"]*gid=([0-9]+)[^"]*"[^>]*>([^<]+)<\/a>/gi
  let m: RegExpExecArray | null = rgx.exec(html)
  while (m) {
    const gid = m[1]
    const label = m[2].trim()
    if (label) map.set(label.toLowerCase(), gid)
    m = rgx.exec(html)
  }
  return map
}

async function fetchCsvTabRows(
  basePubHtmlUrl: string,
  gid: string
): Promise<ParsedCsvRow[]> {
  const csvUrl = basePubHtmlUrl.replace(/\/pubhtml.*$/, `/pub?output=csv&gid=${gid}`)
  const { data } = await axios.get<string>(csvUrl, { timeout: 20000 })
  return parseCsv(String(data))
}

async function fetchCsvSheetRows(
  basePubHtmlUrl: string,
  sheetName: string
): Promise<ParsedCsvRow[]> {
  const csvUrl = basePubHtmlUrl.replace(
    /\/pubhtml.*$/,
    `/pub?output=csv&sheet=${encodeURIComponent(sheetName)}`
  )
  const { data } = await axios.get<string>(csvUrl, { timeout: 20000 })
  return parseCsv(String(data))
}

async function fetchGvizSheetRows(
  spreadsheetId: string,
  sheetName: string
): Promise<ParsedCsvRow[]> {
  // Works for "Anyone with the link can view" sheets without publishing.
  // Also avoids pubhtml/pub CSV caching quirks where `sheet=` is ignored.
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    spreadsheetId
  )}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
  const { data } = await axios.get<string>(url, { timeout: 20000 })
  return parseCsv(String(data))
}

async function fetchGoogleApiRows(
  spreadsheetId: string,
  apiKey: string,
  tabName: string
): Promise<ParsedCsvRow[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(tabName)}?key=${encodeURIComponent(apiKey)}`
  const { data } = await axios.get<{ values?: string[][] }>(url, { timeout: 20000 })
  const rows = data.values || []
  if (rows.length === 0) return []
  const headers = rows[0].map((h) => String(h || "").trim().toLowerCase())
  return rows.slice(1).map((cells) => {
    const out: ParsedCsvRow = {}
    headers.forEach((h, idx) => {
      out[h] = String(cells[idx] || "").trim()
    })
    return out
  })
}

async function fetchGoogleServiceAccountRows(
  spreadsheetId: string,
  clientEmail: string,
  privateKey: string,
  tabName: string
): Promise<ParsedCsvRow[]> {
  const jwtClient = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  })
  const tokenRes = await jwtClient.authorize()
  const accessToken = tokenRes.access_token
  if (!accessToken) throw new Error("ไม่สามารถรับ access token จาก Service Account")
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(tabName)}`
  const { data } = await axios.get<{ values?: string[][] }>(url, {
    timeout: 20000,
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const rows = data.values || []
  if (rows.length === 0) return []
  const headers = rows[0].map((h) => String(h || "").trim().toLowerCase())
  return rows.slice(1).map((cells) => {
    const out: ParsedCsvRow = {}
    headers.forEach((h, idx) => {
      out[h] = String(cells[idx] || "").trim()
    })
    return out
  })
}

function counters(): DiffCounters {
  return { inserted: 0, updated: 0, deleted: 0, skipped: 0 }
}

function pushErr(
  arr: SyncRowError[],
  tab: string,
  rowNumber: number,
  message: string,
  row: ParsedCsvRow
) {
  arr.push({ tab, rowNumber, message, row })
}

async function loadSheetData(): Promise<{
  source: "google_sheets_api" | "published_csv"
  sheetUrl: string
  tabs: string[]
  diseaseRows: ParsedCsvRow[]
  symptomRows: ParsedCsvRow[]
  drugRows: ParsedCsvRow[]
  mappingRows: ParsedCsvRow[]
  healthTipRows: ParsedCsvRow[]
  healthTipRefRows: ParsedCsvRow[]
  i18nUiRows: ParsedCsvRow[]
}> {
  const sheetUrl = process.env.KNOWLEDGE_SHEET_PUBLISHED_URL?.trim() || DEFAULT_SHEET_URL
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY?.trim()
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID?.trim()

  const tabDisease = process.env.KNOWLEDGE_SHEET_TAB_DISEASE?.trim() || "Disease"
  const tabSymptom = process.env.KNOWLEDGE_SHEET_TAB_SYMPTOM?.trim() || "Symptom"
  const tabDrug = process.env.KNOWLEDGE_SHEET_TAB_DRUG?.trim() || "Drug"
  const tabMappingsUnified = process.env.KNOWLEDGE_SHEET_TAB_MAPPINGS?.trim() || "mappings"
  const tabMapDiseaseSymptom =
    process.env.KNOWLEDGE_SHEET_TAB_MAP_DISEASE_SYMPTOM?.trim() || "Map_Disease_Symptom"
  const tabMapDiseaseDrug =
    process.env.KNOWLEDGE_SHEET_TAB_MAP_DISEASE_DRUG?.trim() || "Map_Disease_Drug"
  const tabMapSymptomDrug =
    process.env.KNOWLEDGE_SHEET_TAB_MAP_SYMPTOM_DRUG?.trim() || "Map_Symptom_Drug"
  const tabHealthTip = process.env.KNOWLEDGE_SHEET_TAB_HEALTH_TIP?.trim() || "HealthTip"
  const tabHealthTipRef = process.env.KNOWLEDGE_SHEET_TAB_HEALTH_TIP_REF?.trim() || "HealthTip_Ref"
  const tabI18nUi = process.env.KNOWLEDGE_SHEET_TAB_I18N_UI?.trim() || "I18N_UI"

  if (spreadsheetId && (serviceAccountJson || (serviceAccountEmail && serviceAccountPrivateKey))) {
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
      throw new Error("Service Account ไม่ครบ: ต้องมี client_email และ private_key")
    }
    const normalizedKey = privateKey.replace(/\\n/g, "\n")
    const diseaseRows = await fetchGoogleServiceAccountRows(
      spreadsheetId,
      clientEmail,
      normalizedKey,
      tabDisease
    )
    const symptomRows = await fetchGoogleServiceAccountRows(
      spreadsheetId,
      clientEmail,
      normalizedKey,
      tabSymptom
    )
    const drugRows = await fetchGoogleServiceAccountRows(
      spreadsheetId,
      clientEmail,
      normalizedKey,
      tabDrug
    )
    let mappingRows: ParsedCsvRow[] = []
    try {
      mappingRows = await fetchGoogleServiceAccountRows(
        spreadsheetId,
        clientEmail,
        normalizedKey,
        tabMappingsUnified
      )
    } catch {
      const [dsRows, ddRows, sdRows] = await Promise.all([
        fetchGoogleServiceAccountRows(
          spreadsheetId,
          clientEmail,
          normalizedKey,
          tabMapDiseaseSymptom
        ),
        fetchGoogleServiceAccountRows(
          spreadsheetId,
          clientEmail,
          normalizedKey,
          tabMapDiseaseDrug
        ),
        fetchGoogleServiceAccountRows(
          spreadsheetId,
          clientEmail,
          normalizedKey,
          tabMapSymptomDrug
        ),
      ])
      mappingRows = [
        ...dsRows.map((r) => ({ ...r, map_type: "disease_symptom" })),
        ...ddRows.map((r) => ({ ...r, map_type: "disease_drug" })),
        ...sdRows.map((r) => ({ ...r, map_type: "symptom_drug" })),
      ]
    }
    let [healthTipRows, healthTipRefRows, i18nUiRows] = await Promise.all([
      fetchGoogleServiceAccountRows(spreadsheetId, clientEmail, normalizedKey, tabHealthTip).catch(
        () => []
      ),
      fetchGoogleServiceAccountRows(
        spreadsheetId,
        clientEmail,
        normalizedKey,
        tabHealthTipRef
      ).catch(() => []),
      fetchGoogleServiceAccountRows(spreadsheetId, clientEmail, normalizedKey, tabI18nUi).catch(
        () => []
      ),
    ])
    if (!isHealthTipShape(healthTipRows)) healthTipRows = []
    if (!isHealthTipRefShape(healthTipRefRows)) healthTipRefRows = []
    if (!isI18nUiShape(i18nUiRows)) i18nUiRows = []
    return {
      source: "google_sheets_api",
      sheetUrl,
      tabs: [tabDisease, tabSymptom, tabDrug, tabMappingsUnified],
      diseaseRows,
      symptomRows,
      drugRows,
      mappingRows,
      healthTipRows,
      healthTipRefRows,
      i18nUiRows,
    }
  }

  if (apiKey && spreadsheetId) {
    const diseaseRows = await fetchGoogleApiRows(spreadsheetId, apiKey, tabDisease)
    const symptomRows = await fetchGoogleApiRows(spreadsheetId, apiKey, tabSymptom)
    const drugRows = await fetchGoogleApiRows(spreadsheetId, apiKey, tabDrug)
    let mappingRows: ParsedCsvRow[] = []
    try {
      mappingRows = await fetchGoogleApiRows(spreadsheetId, apiKey, tabMappingsUnified)
    } catch {
      const [dsRows, ddRows, sdRows] = await Promise.all([
        fetchGoogleApiRows(spreadsheetId, apiKey, tabMapDiseaseSymptom),
        fetchGoogleApiRows(spreadsheetId, apiKey, tabMapDiseaseDrug),
        fetchGoogleApiRows(spreadsheetId, apiKey, tabMapSymptomDrug),
      ])
      mappingRows = [
        ...dsRows.map((r) => ({ ...r, map_type: "disease_symptom" })),
        ...ddRows.map((r) => ({ ...r, map_type: "disease_drug" })),
        ...sdRows.map((r) => ({ ...r, map_type: "symptom_drug" })),
      ]
    }
    let [healthTipRows, healthTipRefRows, i18nUiRows] = await Promise.all([
      fetchGoogleApiRows(spreadsheetId, apiKey, tabHealthTip).catch(() => []),
      fetchGoogleApiRows(spreadsheetId, apiKey, tabHealthTipRef).catch(() => []),
      fetchGoogleApiRows(spreadsheetId, apiKey, tabI18nUi).catch(() => []),
    ])
    if (!isHealthTipShape(healthTipRows)) healthTipRows = []
    if (!isHealthTipRefShape(healthTipRefRows)) healthTipRefRows = []
    if (!isI18nUiShape(i18nUiRows)) i18nUiRows = []
    return {
      source: "google_sheets_api",
      sheetUrl,
      tabs: [tabDisease, tabSymptom, tabDrug, tabMappingsUnified],
      diseaseRows,
      symptomRows,
      drugRows,
      mappingRows,
      healthTipRows,
      healthTipRefRows,
      i18nUiRows,
    }
  }

  // If sheet is publicly viewable ("anyone with link"), we can fetch via gviz without API key.
  // This avoids pubhtml -> pub CSV issues where `sheet=` can be ignored.
  if (spreadsheetId) {
    const diseaseRows = await fetchGvizSheetRows(spreadsheetId, tabDisease).catch(() => [])
    const symptomRows = await fetchGvizSheetRows(spreadsheetId, tabSymptom).catch(() => [])
    const drugRows = await fetchGvizSheetRows(spreadsheetId, tabDrug).catch(() => [])
    let mappingRows: ParsedCsvRow[] = []
    mappingRows = await fetchGvizSheetRows(spreadsheetId, tabMappingsUnified).catch(() => [])
    if (mappingRows.length > 0 && !isValidUnifiedMappingsShape(mappingRows)) mappingRows = []
    if (mappingRows.length === 0) {
      const [dsRows, ddRows, sdRows] = await Promise.all([
        fetchGvizSheetRows(spreadsheetId, tabMapDiseaseSymptom).catch(() => []),
        fetchGvizSheetRows(spreadsheetId, tabMapDiseaseDrug).catch(() => []),
        fetchGvizSheetRows(spreadsheetId, tabMapSymptomDrug).catch(() => []),
      ])
      mappingRows = [
        ...dsRows.map((r) => ({ ...r, map_type: "disease_symptom" })),
        ...ddRows.map((r) => ({ ...r, map_type: "disease_drug" })),
        ...sdRows.map((r) => ({ ...r, map_type: "symptom_drug" })),
      ]
    }
    let [healthTipRows, healthTipRefRows, i18nUiRows] = await Promise.all([
      fetchGvizSheetRows(spreadsheetId, tabHealthTip).catch(() => []),
      fetchGvizSheetRows(spreadsheetId, tabHealthTipRef).catch(() => []),
      fetchGvizSheetRows(spreadsheetId, tabI18nUi).catch(() => []),
    ])
    if (!isHealthTipShape(healthTipRows)) healthTipRows = []
    if (!isHealthTipRefShape(healthTipRefRows)) healthTipRefRows = []
    if (!isI18nUiShape(i18nUiRows)) i18nUiRows = []

    const diseaseType = detectSheetType(diseaseRows)
    const symptomType = detectSheetType(symptomRows)
    const drugType = detectSheetType(drugRows)
    if (diseaseType === "disease" && symptomType === "symptom" && drugType === "drug") {
      if (mappingRows.length === 0) throw new Error("ไม่พบแท็บ mappings หรือ mapping แยก 3 แท็บ")
      return {
        source: "published_csv",
        sheetUrl,
        tabs: [tabDisease, tabSymptom, tabDrug, tabMappingsUnified],
        diseaseRows,
        symptomRows,
        drugRows,
        mappingRows,
        healthTipRows,
        healthTipRefRows,
        i18nUiRows,
      }
    }
    // else fallthrough to published pubhtml flow for backward compatibility,
    // but keep the richer error messages there.
  }

  const tabs = await getPublishedTabs(sheetUrl)
  // Published HTML often doesn't contain per-tab anchors anymore.
  // Prefer fetching CSV by sheet name, fall back to gid-based when available.
  const diseaseRows = await fetchPublishedSheetWithFallback(
    sheetUrl,
    tabDisease,
    tabs.get(tabDisease.toLowerCase())
  )
  const symptomRows = await fetchPublishedSheetWithFallback(
    sheetUrl,
    tabSymptom,
    tabs.get(tabSymptom.toLowerCase())
  )
  const drugRows = await fetchPublishedSheetWithFallback(
    sheetUrl,
    tabDrug,
    tabs.get(tabDrug.toLowerCase())
  )

  const diseaseType = detectSheetType(diseaseRows)
  const symptomType = detectSheetType(symptomRows)
  const drugType = detectSheetType(drugRows)

  if (diseaseType !== "disease") {
    throw new Error(
      `Published Google Sheet: แท็บ ${tabDisease} ไม่ถูกต้อง (keys=${firstRowKeysPreview(diseaseRows)})`
    )
  }
  if (symptomType !== "symptom") {
    throw new Error(
      `Published Google Sheet: แท็บ ${tabSymptom} ไม่ถูกต้อง (keys=${firstRowKeysPreview(symptomRows)})`
    )
  }
  if (drugType !== "drug") {
    const hint =
      drugType === "disease"
        ? `ตอน export sheet=${tabDrug} ได้ข้อมูลแบบ Disease — มักเกิดจากชื่อแท็บมีช่องว่าง/ตัวอักษรซ่อน หรือ export หาแท็บไม่เจอแล้ว fallback ไปแท็บแรก`
        : `ต้องมี header drug_ref`
    throw new Error(
      `Published Google Sheet: แท็บ ${tabDrug} ไม่ถูกต้อง (type=${drugType}, keys=${firstRowKeysPreview(
        drugRows
      )}) — ${hint}`
    )
  }
  let mappingRows: ParsedCsvRow[] = []

  // 1) unified mappings tab
  if (tabs.has(tabMappingsUnified.toLowerCase())) {
    mappingRows = await fetchCsvTabRows(sheetUrl, tabs.get(tabMappingsUnified.toLowerCase()) || "")
  } else {
    mappingRows = await fetchCsvSheetRows(sheetUrl, tabMappingsUnified).catch(() => [])
  }
  // Ignore mappings tab if it doesn't follow the expected structure (common mistake: copy Disease rows here).
  if (mappingRows.length > 0 && !isValidUnifiedMappingsShape(mappingRows)) {
    mappingRows = []
  }

  // 2) separate mapping tabs (only if unified not available)
  if (mappingRows.length === 0) {
    if (
      tabs.has(tabMapDiseaseSymptom.toLowerCase()) &&
      tabs.has(tabMapDiseaseDrug.toLowerCase()) &&
      tabs.has(tabMapSymptomDrug.toLowerCase())
    ) {
      const [dsRows, ddRows, sdRows] = await Promise.all([
        fetchCsvTabRows(sheetUrl, tabs.get(tabMapDiseaseSymptom.toLowerCase()) || ""),
        fetchCsvTabRows(sheetUrl, tabs.get(tabMapDiseaseDrug.toLowerCase()) || ""),
        fetchCsvTabRows(sheetUrl, tabs.get(tabMapSymptomDrug.toLowerCase()) || ""),
      ])
      mappingRows = [
        ...dsRows.map((r) => ({ ...r, map_type: "disease_symptom" })),
        ...ddRows.map((r) => ({ ...r, map_type: "disease_drug" })),
        ...sdRows.map((r) => ({ ...r, map_type: "symptom_drug" })),
      ]
    } else {
      const [dsRows, ddRows, sdRows] = await Promise.all([
        fetchCsvSheetRows(sheetUrl, tabMapDiseaseSymptom).catch(() => []),
        fetchCsvSheetRows(sheetUrl, tabMapDiseaseDrug).catch(() => []),
        fetchCsvSheetRows(sheetUrl, tabMapSymptomDrug).catch(() => []),
      ])
      mappingRows = [
        ...dsRows.map((r) => ({ ...r, map_type: "disease_symptom" })),
        ...ddRows.map((r) => ({ ...r, map_type: "disease_drug" })),
        ...sdRows.map((r) => ({ ...r, map_type: "symptom_drug" })),
      ]
    }
  }

  if (mappingRows.length === 0) {
    throw new Error("ไม่พบแท็บ mappings หรือ mapping แยก 3 แท็บ")
  }
  const [healthTipRows, healthTipRefRows, i18nUiRows] = await Promise.all([
    fetchPublishedSheetWithFallback(sheetUrl, tabHealthTip, tabs.get(tabHealthTip.toLowerCase())),
    fetchPublishedSheetWithFallback(
      sheetUrl,
      tabHealthTipRef,
      tabs.get(tabHealthTipRef.toLowerCase())
    ),
    fetchPublishedSheetWithFallback(sheetUrl, tabI18nUi, tabs.get(tabI18nUi.toLowerCase())),
  ])
  const safeHealthTipRows = isHealthTipShape(healthTipRows) ? healthTipRows : []
  const safeHealthTipRefRows = isHealthTipRefShape(healthTipRefRows) ? healthTipRefRows : []
  const safeI18nUiRows = isI18nUiShape(i18nUiRows) ? i18nUiRows : []
  return {
    source: "published_csv",
    sheetUrl,
    tabs: Array.from(tabs.keys()),
    diseaseRows,
    symptomRows,
    drugRows,
    mappingRows,
    healthTipRows: safeHealthTipRows,
    healthTipRefRows: safeHealthTipRefRows,
    i18nUiRows: safeI18nUiRows,
  }
}

export async function syncKnowledgeFromSheet(options?: {
  dryRun?: boolean
}): Promise<KnowledgeSyncResult> {
  const dryRun = options?.dryRun !== false
  const deleteMode =
    String(process.env.SYNC_DELETE_MODE || "soft").trim().toLowerCase() === "hard"
      ? "hard"
      : "soft"
  const createMissingDrugs =
    ["1", "true", "yes", "y"].includes(
      String(process.env.KNOWLEDGE_SYNC_CREATE_MISSING_DRUGS || "").trim().toLowerCase()
    )
  const errors: SyncRowError[] = []
  const diseaseStats = counters()
  const symptomStats = counters()
  const drugStats = counters()
  const healthTipStats = counters()
  const healthTipRefStats = counters()
  const i18nUiStats = counters()
  const dsStats = counters()
  const ddStats = counters()
  const sdStats = counters()

  const sourceData = await loadSheetData()
  const {
    source,
    sheetUrl,
    tabs,
    diseaseRows,
    symptomRows,
    drugRows,
    mappingRows,
    healthTipRows,
    healthTipRefRows,
    i18nUiRows,
  } = sourceData

  const [existingDiseases, existingSymptoms, existingDrugs, existingTips] = await Promise.all([
    prisma.knowledgeDisease.findMany({ select: { id: true, slug: true } }),
    prisma.knowledgeSymptom.findMany({ select: { id: true, slug: true } }),
    prisma.drug.findMany({ select: { id: true, slug: true, slotId: true } }),
    prisma.knowledgeHealthTip.findMany({ select: { id: true, slug: true } }),
  ])

  const diseaseBySlug = new Map(existingDiseases.map((d) => [d.slug, d]))
  const symptomBySlug = new Map(existingSymptoms.map((s) => [s.slug, s]))
  const drugByRefCI = new Map<string, { id: string; slug: string | null; slotId: string }>()
  const drugById = new Map<string, { id: string; slug: string | null; slotId: string }>()
  for (const d of existingDrugs) {
    drugById.set(d.id, d)
    drugByRefCI.set(normalizeRefKey(d.slotId), d)
    if (d.slug) drugByRefCI.set(normalizeRefKey(d.slug), d)
  }

  const incomingDiseaseSlugs = new Set<string>()
  const incomingSymptomSlugs = new Set<string>()
  const incomingDrugIds = new Set<string>()
  const drugRefsInSheet = new Set<string>()
  const incomingTipSlugs = new Set<string>()
  const incomingUiKeys = new Set<string>()

  const mappingDiseaseSymptom: { diseaseSlug: string; symptomSlug: string; score: number; note: string }[] = []
  const mappingDiseaseDrug: { diseaseSlug: string; drugRef: string; level: string; note: string }[] = []
  const mappingSymptomDrug: { symptomSlug: string; drugRef: string; level: string; note: string }[] = []
  const tipRefRowsNormalized: {
    tipSlug: string
    title: string
    url: string
    publisher: string
    accessedAt: string
    note: string
    isPublished: boolean
  }[] = []
  const i18nUiRowsNormalized: {
    namespace: string
    key: string
    th: string
    en: string
    isPublished: boolean
    sourceUpdatedBy: string
    sourceUpdatedAt: string
  }[] = []

  for (const [idx, row] of diseaseRows.entries()) {
    const slug = normalizeSlug(row.slug || row.name_th || row.name || "")
    const nameTh = row.name_th || row.name || ""
    if (!slug || !nameTh) {
      diseaseStats.skipped += 1
      pushErr(errors, "Disease", idx + 2, "missing required fields: slug/name_th", row)
      continue
    }
    incomingDiseaseSlugs.add(slug)
    if (diseaseBySlug.has(slug)) diseaseStats.updated += 1
    else diseaseStats.inserted += 1
  }

  for (const [idx, row] of symptomRows.entries()) {
    const slug = normalizeSlug(row.slug || row.name_th || row.name || "")
    const nameTh = row.name_th || row.name || ""
    if (!slug || !nameTh) {
      symptomStats.skipped += 1
      pushErr(errors, "Symptom", idx + 2, "missing required fields: slug/name_th", row)
      continue
    }
    incomingSymptomSlugs.add(slug)
    if (symptomBySlug.has(slug)) symptomStats.updated += 1
    else symptomStats.inserted += 1
  }

  for (const [idx, row] of drugRows.entries()) {
    const refRaw = row.drug_ref || row.slotid || row.slot_id || ""
    const ref = String(refRaw).trim()
    if (!ref) {
      drugStats.skipped += 1
      pushErr(errors, "Drug", idx + 2, "missing required field: drug_ref", row)
      continue
    }
    drugRefsInSheet.add(normalizeRefKey(ref))
    const found = drugById.get(ref) || drugByRefCI.get(normalizeRefKey(ref))
    if (!found) {
      if (createMissingDrugs) {
        drugStats.inserted += 1
      } else {
        drugStats.skipped += 1
        pushErr(
          errors,
          "Drug",
          idx + 2,
          `drug_ref not found in DB: ${ref} (ตั้ง KNOWLEDGE_SYNC_CREATE_MISSING_DRUGS=1 เพื่อให้ระบบสร้างยาใหม่อัตโนมัติ)`,
          row
        )
        continue
      }
    } else {
      incomingDrugIds.add(found.id)
      drugStats.updated += 1
    }
    const kp = row.knowledge_priority?.trim()
    if (kp && !isNumericString(kp)) {
      drugStats.skipped += 1
      pushErr(errors, "Drug", idx + 2, "knowledge_priority must be number", row)
    }
  }

  for (const [idx, row] of mappingRows.entries()) {
    const mapType = (row.map_type || row.type || "").trim().toLowerCase()
    const left = normalizeSlug(
      row.left_ref || row.left_slug || row.disease_slug || row.symptom_slug || ""
    )
    const right = (row.right_ref || row.right_slug || row.drug_ref || row.symptom_slug || "").trim()
    const rightKey = normalizeRefKey(right)
    const scoreRaw = row.score || row.relevance_score || ""
    const score = scoreRaw ? toInt(scoreRaw, 0) : 0
    const note = row.note || ""
    const level = row.recommendation_level || "SUGGESTED"

    if (!mapType || !left || !right) {
      if (hasAnyValue(row)) {
        pushErr(
          errors,
          "mappings",
          idx + 2,
          "missing mapping fields: map_type/left_ref/right_ref",
          row
        )
      }
      continue
    }
    if ((mapType === "disease_symptom" || mapType === "symptom_disease") && scoreRaw && !isNumericString(scoreRaw)) {
      pushErr(errors, "mappings", idx + 2, "score/relevance_score must be number", row)
      dsStats.skipped += 1
      continue
    }

    if (mapType === "disease_symptom") {
      const symptomSlug = normalizeSlug(right)
      const diseaseOk = incomingDiseaseSlugs.has(left) || diseaseBySlug.has(left)
      const symptomOk = incomingSymptomSlugs.has(symptomSlug) || symptomBySlug.has(symptomSlug)
      if (!diseaseOk || !symptomOk) {
        dsStats.skipped += 1
        pushErr(
          errors,
          "mappings",
          idx + 2,
          `mapping target not found (disease=${left} in Disease tab? ${diseaseOk}, symptom=${symptomSlug} in Symptom tab? ${symptomOk})`,
          row
        )
        continue
      }
      dsStats.inserted += 1
      mappingDiseaseSymptom.push({
        diseaseSlug: left,
        symptomSlug,
        score,
        note,
      })
    } else if (mapType === "disease_drug") {
      const diseaseOk = incomingDiseaseSlugs.has(left) || diseaseBySlug.has(left)
      if (!diseaseOk) {
        ddStats.skipped += 1
        pushErr(errors, "mappings", idx + 2, `disease_slug not found in Disease tab: ${left}`, row)
        continue
      }
      if (!drugRefsInSheet.has(rightKey)) {
        ddStats.skipped += 1
        pushErr(
          errors,
          "mappings",
          idx + 2,
          `drug_ref not found in Drug tab: ${right} (add it to Drug sheet first)`,
          row
        )
        continue
      }
      ddStats.inserted += 1
      mappingDiseaseDrug.push({
        diseaseSlug: left,
        drugRef: right,
        level,
        note,
      })
    } else if (mapType === "symptom_drug") {
      const symptomOk = incomingSymptomSlugs.has(left) || symptomBySlug.has(left)
      if (!symptomOk) {
        sdStats.skipped += 1
        pushErr(errors, "mappings", idx + 2, `symptom_slug not found in Symptom tab: ${left}`, row)
        continue
      }
      if (!drugRefsInSheet.has(rightKey)) {
        sdStats.skipped += 1
        pushErr(
          errors,
          "mappings",
          idx + 2,
          `drug_ref not found in Drug tab: ${right} (add it to Drug sheet first)`,
          row
        )
        continue
      }
      sdStats.inserted += 1
      mappingSymptomDrug.push({
        symptomSlug: left,
        drugRef: right,
        level,
        note,
      })
    } else {
      pushErr(errors, "mappings", idx + 2, `unknown map_type: ${mapType}`, row)
    }
  }

  const tipBySlug = new Map(existingTips.map((t) => [t.slug, t]))
  for (const [idx, row] of healthTipRows.entries()) {
    const slug = normalizeSlug(row.slug || row.title_th || row.title || "")
    const titleTh = row.title_th || row.title || ""
    if (!slug || !titleTh) {
      healthTipStats.skipped += 1
      pushErr(errors, "HealthTip", idx + 2, "missing required fields: slug/title_th", row)
      continue
    }
    incomingTipSlugs.add(slug)
    if (tipBySlug.has(slug)) healthTipStats.updated += 1
    else healthTipStats.inserted += 1
  }

  for (const [idx, row] of healthTipRefRows.entries()) {
    const tipSlug = normalizeSlug(row.tip_slug || row.health_tip_slug || "")
    const title = String(row.ref_title || row.title || "").trim()
    const url = String(row.ref_url || row.url || "").trim()
    if (!hasAnyValue(row)) continue
    if (!tipSlug || !title || !url) {
      healthTipRefStats.skipped += 1
      pushErr(errors, "HealthTip_Ref", idx + 2, "missing required fields: tip_slug/ref_title/ref_url", row)
      continue
    }
    const tipOk = incomingTipSlugs.has(tipSlug) || tipBySlug.has(tipSlug)
    if (!tipOk) {
      healthTipRefStats.skipped += 1
      pushErr(errors, "HealthTip_Ref", idx + 2, `tip_slug not found in HealthTip tab: ${tipSlug}`, row)
      continue
    }
    healthTipRefStats.inserted += 1
    tipRefRowsNormalized.push({
      tipSlug,
      title,
      url,
      publisher: String(row.ref_publisher || row.publisher || "").trim(),
      accessedAt: String(row.accessed_at || "").trim(),
      note: String(row.note || "").trim(),
      isPublished: row.published ? toBool(row.published) : true,
    })
  }

  const existingUiRows = await prisma.uiTranslation.findMany({
    select: { namespace: true, key: true },
  })
  const existingUiKeys = new Set(existingUiRows.map((r) => `${r.namespace}::${r.key}`))
  for (const [idx, row] of i18nUiRows.entries()) {
    if (!hasAnyValue(row)) continue
    const namespace = String(row.namespace || "").trim()
    const key = String(row.key || "").trim()
    const th = String(row.th || "").trim()
    const en = String(row.en || "").trim()
    if (!namespace || !key || !th) {
      i18nUiStats.skipped += 1
      pushErr(errors, "I18N_UI", idx + 2, "missing required fields: namespace/key/th", row)
      continue
    }
    const fullKey = `${namespace}::${key}`
    incomingUiKeys.add(fullKey)
    if (existingUiKeys.has(fullKey)) i18nUiStats.updated += 1
    else i18nUiStats.inserted += 1
    i18nUiRowsNormalized.push({
      namespace,
      key,
      th,
      en,
      isPublished: row.published ? toBool(row.published) : true,
      sourceUpdatedBy: String(row.updated_by || "").trim(),
      sourceUpdatedAt: String(row.updated_at || "").trim(),
    })
  }

  diseaseStats.deleted = existingDiseases.filter((d) => !incomingDiseaseSlugs.has(d.slug)).length
  symptomStats.deleted = existingSymptoms.filter((s) => !incomingSymptomSlugs.has(s.slug)).length
  drugStats.deleted = existingDrugs.filter((d) => !incomingDrugIds.has(d.id)).length
  healthTipStats.deleted = existingTips.filter((t) => !incomingTipSlugs.has(t.slug)).length
  // references are replaced per sync
  healthTipRefStats.deleted = 0
  i18nUiStats.deleted = existingUiRows.filter((r) => !incomingUiKeys.has(`${r.namespace}::${r.key}`)).length
  dsStats.deleted = await prisma.diseaseSymptomMap.count()
  ddStats.deleted = await prisma.diseaseDrugMap.count()
  sdStats.deleted = await prisma.symptomDrugMap.count()

  if (!dryRun && errors.length === 0) {
    await prisma.$transaction(async (tx) => {
      for (const row of diseaseRows) {
        const slug = normalizeSlug(row.slug || row.name_th || row.name || "")
        const nameTh = row.name_th || row.name || ""
        if (!slug || !nameTh) continue
        await tx.knowledgeDisease.upsert({
          where: { slug },
          update: {
            nameTh,
            nameEn: row.name_en || null,
            definition: row.definition || "",
            severityLevel: row.severity_level || "ROUTINE",
            selfCareAdvice: row.self_care_advice || "",
            redFlagAdvice: row.red_flag_advice || "",
            keywords: row.keywords || "",
            isPublished: row.published ? toBool(row.published) : true,
          },
          create: {
            slug,
            nameTh,
            nameEn: row.name_en || null,
            definition: row.definition || "",
            severityLevel: row.severity_level || "ROUTINE",
            selfCareAdvice: row.self_care_advice || "",
            redFlagAdvice: row.red_flag_advice || "",
            keywords: row.keywords || "",
            isPublished: row.published ? toBool(row.published) : true,
          },
        })
      }
      for (const row of symptomRows) {
        const slug = normalizeSlug(row.slug || row.name_th || row.name || "")
        const nameTh = row.name_th || row.name || ""
        if (!slug || !nameTh) continue
        await tx.knowledgeSymptom.upsert({
          where: { slug },
          update: {
            nameTh,
            nameEn: row.name_en || null,
            observationGuide: row.observation_guide || "",
            firstAid: row.first_aid || "",
            dangerLevel: row.danger_level || "LOW",
            redFlag: row.red_flag ? toBool(row.red_flag) : false,
            keywords: row.keywords || "",
            isPublished: row.published ? toBool(row.published) : true,
          },
          create: {
            slug,
            nameTh,
            nameEn: row.name_en || null,
            observationGuide: row.observation_guide || "",
            firstAid: row.first_aid || "",
            dangerLevel: row.danger_level || "LOW",
            redFlag: row.red_flag ? toBool(row.red_flag) : false,
            keywords: row.keywords || "",
            isPublished: row.published ? toBool(row.published) : true,
          },
        })
      }
      for (const row of drugRows) {
        const ref = String(row.drug_ref || row.slotid || row.slot_id || "").trim()
        if (!ref) continue
        const byId = await tx.drug.findUnique({ where: { id: ref } }).catch(() => null)
        const bySlot = await tx.drug.findFirst({ where: { slotId: ref } })
        const bySlug = row.slug
          ? await tx.drug.findFirst({ where: { slug: normalizeSlug(row.slug) } })
          : null
        const found = byId || bySlot || bySlug
        const desiredSlug = row.slug ? normalizeSlug(row.slug) : null
        const name =
          row.brand_name || row.generic_name || desiredSlug || ref
        const description = row.indication || ""
        if (!found) {
          if (!createMissingDrugs) continue
          await tx.drug.create({
            data: {
              slotId: ref,
              name,
              description,
              slug: desiredSlug,
              genericName: row.generic_name || null,
              brandName: row.brand_name || null,
              indication: row.indication || null,
              contraindications: row.contraindications || null,
              doseByAgeWeight: row.dose_by_age_weight || null,
              keywords: row.keywords || "",
              isPublished: row.published ? toBool(row.published) : true,
              knowledgePriority: toInt(row.knowledge_priority, 0),
            },
          })
        } else {
          await tx.drug.update({
            where: { id: found.id },
            data: {
              slug: desiredSlug ?? found.slug,
              genericName: row.generic_name || null,
              brandName: row.brand_name || null,
              indication: row.indication || null,
              contraindications: row.contraindications || null,
              doseByAgeWeight: row.dose_by_age_weight || null,
              keywords: row.keywords || "",
              isPublished: row.published ? toBool(row.published) : true,
              knowledgePriority: toInt(row.knowledge_priority, 0),
            },
          })
        }
      }

      for (const row of healthTipRows) {
        const slug = normalizeSlug(row.slug || row.title_th || row.title || "")
        const titleTh = row.title_th || row.title || ""
        if (!slug || !titleTh) continue
        await tx.knowledgeHealthTip.upsert({
          where: { slug },
          update: {
            titleTh,
            titleEn: row.title_en || null,
            summaryTh: row.summary_th || "",
            summaryEn: row.summary_en || "",
            contentMdTh: row.content_md_th || row.content_md || "",
            contentMdEn: row.content_md_en || "",
            keywords: row.keywords || "",
            category: row.category || null,
            coverImageUrl: row.cover_image_url || null,
            isPublished: row.published ? toBool(row.published) : true,
          },
          create: {
            slug,
            titleTh,
            titleEn: row.title_en || null,
            summaryTh: row.summary_th || "",
            summaryEn: row.summary_en || "",
            contentMdTh: row.content_md_th || row.content_md || "",
            contentMdEn: row.content_md_en || "",
            keywords: row.keywords || "",
            category: row.category || null,
            coverImageUrl: row.cover_image_url || null,
            isPublished: row.published ? toBool(row.published) : true,
          },
        })
      }

      if (deleteMode === "soft") {
        await tx.knowledgeHealthTip.updateMany({
          where: { slug: { notIn: Array.from(incomingTipSlugs) }, isPublished: true },
          data: { isPublished: false },
        })
      } else {
        await tx.knowledgeHealthTip.deleteMany({
          where: { slug: { notIn: Array.from(incomingTipSlugs) } },
        })
      }

      // Replace all references each sync (simple + deterministic)
      await tx.knowledgeHealthTipReference.deleteMany({})
      if (tipRefRowsNormalized.length > 0) {
        const tipRows = await tx.knowledgeHealthTip.findMany({
          where: { slug: { in: Array.from(new Set(tipRefRowsNormalized.map((r) => r.tipSlug))) } },
          select: { id: true, slug: true },
        })
        const tipIdBySlug = new Map(tipRows.map((r) => [r.slug, r.id]))
        await tx.knowledgeHealthTipReference.createMany({
          data: tipRefRowsNormalized
            .map((r) => ({
              tipId: tipIdBySlug.get(r.tipSlug) || "",
              title: r.title,
              url: r.url,
              publisher: r.publisher || null,
              accessedAt: r.accessedAt ? new Date(r.accessedAt) : null,
              note: r.note || "",
              isPublished: r.isPublished,
            }))
            .filter((r) => r.tipId),
        })
      }

      for (const row of i18nUiRowsNormalized) {
        await tx.uiTranslation.upsert({
          where: { namespace_key: { namespace: row.namespace, key: row.key } },
          update: {
            th: row.th,
            en: row.en,
            isPublished: row.isPublished,
            sourceUpdatedBy: row.sourceUpdatedBy || null,
            sourceUpdatedAt: row.sourceUpdatedAt || null,
          },
          create: {
            namespace: row.namespace,
            key: row.key,
            th: row.th,
            en: row.en,
            isPublished: row.isPublished,
            sourceUpdatedBy: row.sourceUpdatedBy || null,
            sourceUpdatedAt: row.sourceUpdatedAt || null,
          },
        })
      }

      if (deleteMode === "soft") {
        if (i18nUiRowsNormalized.length > 0) {
          await tx.uiTranslation.updateMany({
            where: {
              NOT: i18nUiRowsNormalized.map((r) => ({ namespace: r.namespace, key: r.key })),
              isPublished: true,
            },
            data: { isPublished: false },
          })
        } else {
          await tx.uiTranslation.updateMany({
            where: { isPublished: true },
            data: { isPublished: false },
          })
        }
      } else {
        if (i18nUiRowsNormalized.length > 0) {
          await tx.uiTranslation.deleteMany({
            where: {
              NOT: i18nUiRowsNormalized.map((r) => ({ namespace: r.namespace, key: r.key })),
            },
          })
        } else {
          await tx.uiTranslation.deleteMany({})
        }
      }

      if (deleteMode === "soft") {
        await tx.knowledgeDisease.updateMany({
          where: {
            slug: { notIn: Array.from(incomingDiseaseSlugs) },
            isPublished: true,
          },
          data: { isPublished: false },
        })
        await tx.knowledgeSymptom.updateMany({
          where: {
            slug: { notIn: Array.from(incomingSymptomSlugs) },
            isPublished: true,
          },
          data: { isPublished: false },
        })
        await tx.drug.updateMany({
          where: {
            id: { notIn: Array.from(incomingDrugIds) },
            isPublished: true,
          },
          data: { isPublished: false },
        })
      } else {
        // Hard delete is allowed for knowledge-only entities.
        await tx.knowledgeDisease.deleteMany({
          where: { slug: { notIn: Array.from(incomingDiseaseSlugs) } },
        })
        await tx.knowledgeSymptom.deleteMany({
          where: { slug: { notIn: Array.from(incomingSymptomSlugs) } },
        })
        // Drug is never hard-deleted by sync because historical sessions may reference it.
        await tx.drug.updateMany({
          where: { id: { notIn: Array.from(incomingDrugIds) }, isPublished: true },
          data: { isPublished: false },
        })
      }

      await tx.diseaseSymptomMap.deleteMany({})
      await tx.diseaseDrugMap.deleteMany({})
      await tx.symptomDrugMap.deleteMany({})

      const diseaseSlugs = Array.from(
        new Set(mappingDiseaseSymptom.map((m) => m.diseaseSlug).concat(mappingDiseaseDrug.map((m) => m.diseaseSlug)))
      )
      const symptomSlugs = Array.from(
        new Set(mappingDiseaseSymptom.map((m) => m.symptomSlug).concat(mappingSymptomDrug.map((m) => m.symptomSlug)))
      )
      const drugRefs = Array.from(
        new Set(mappingDiseaseDrug.map((m) => normalizeRefKey(m.drugRef)).concat(mappingSymptomDrug.map((m) => normalizeRefKey(m.drugRef))))
      )

      const [dRows, sRows, drRows] = await Promise.all([
        tx.knowledgeDisease.findMany({ where: { slug: { in: diseaseSlugs } }, select: { id: true, slug: true } }),
        tx.knowledgeSymptom.findMany({ where: { slug: { in: symptomSlugs } }, select: { id: true, slug: true } }),
        tx.drug.findMany({
          where: {
            OR: [
              { slotId: { in: drugRefs.map((r) => r) } },
              { slug: { in: drugRefs.map((r) => r) } },
              { id: { in: drugRefs.map((r) => r) } },
            ],
          },
          select: { id: true, slotId: true, slug: true },
        }),
      ])
      const diseaseIdBySlug = new Map(dRows.map((r) => [r.slug, r.id]))
      const symptomIdBySlug = new Map(sRows.map((r) => [r.slug, r.id]))
      const drugIdByRef = new Map<string, string>()
      for (const r of drRows) {
        drugIdByRef.set(normalizeRefKey(r.slotId), r.id)
        if (r.slug) drugIdByRef.set(normalizeRefKey(r.slug), r.id)
        drugIdByRef.set(normalizeRefKey(r.id), r.id)
      }

      if (mappingDiseaseSymptom.length > 0) {
        await tx.diseaseSymptomMap.createMany({
          data: mappingDiseaseSymptom
            .map((m) => ({
              diseaseId: diseaseIdBySlug.get(m.diseaseSlug) || "",
              symptomId: symptomIdBySlug.get(m.symptomSlug) || "",
            relevanceScore: m.score,
            note: m.note,
            }))
            .filter((m) => m.diseaseId && m.symptomId),
        })
      }
      if (mappingDiseaseDrug.length > 0) {
        await tx.diseaseDrugMap.createMany({
          data: mappingDiseaseDrug
            .map((m) => ({
              diseaseId: diseaseIdBySlug.get(m.diseaseSlug) || "",
              drugId: drugIdByRef.get(normalizeRefKey(m.drugRef)) || "",
            recommendationLevel: m.level,
            note: m.note,
            }))
            .filter((m) => m.diseaseId && m.drugId),
        })
      }
      if (mappingSymptomDrug.length > 0) {
        await tx.symptomDrugMap.createMany({
          data: mappingSymptomDrug
            .map((m) => ({
              symptomId: symptomIdBySlug.get(m.symptomSlug) || "",
              drugId: drugIdByRef.get(normalizeRefKey(m.drugRef)) || "",
            recommendationLevel: m.level,
            note: m.note,
            }))
            .filter((m) => m.symptomId && m.drugId),
        })
      }
    })
  }

  return {
    source,
    sheetUrl,
    tabs,
    dryRun,
    deleteMode,
    disease: diseaseStats,
    symptom: symptomStats,
    drug: drugStats,
    healthTip: healthTipStats,
    healthTipRef: healthTipRefStats,
    i18nUi: i18nUiStats,
    diseaseSymptomMap: dsStats,
    diseaseDrugMap: ddStats,
    symptomDrugMap: sdStats,
    errors,
  }
}
