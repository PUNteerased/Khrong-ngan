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
}> {
  const sheetUrl = process.env.KNOWLEDGE_SHEET_PUBLISHED_URL?.trim() || DEFAULT_SHEET_URL
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY?.trim()
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID?.trim()

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
      "Disease"
    )
    const symptomRows = await fetchGoogleServiceAccountRows(
      spreadsheetId,
      clientEmail,
      normalizedKey,
      "Symptom"
    )
    const drugRows = await fetchGoogleServiceAccountRows(
      spreadsheetId,
      clientEmail,
      normalizedKey,
      "Drug"
    )
    let mappingRows: ParsedCsvRow[] = []
    try {
      mappingRows = await fetchGoogleServiceAccountRows(
        spreadsheetId,
        clientEmail,
        normalizedKey,
        "mappings"
      )
    } catch {
      const [dsRows, ddRows, sdRows] = await Promise.all([
        fetchGoogleServiceAccountRows(
          spreadsheetId,
          clientEmail,
          normalizedKey,
          "Map_Disease_Symptom"
        ),
        fetchGoogleServiceAccountRows(
          spreadsheetId,
          clientEmail,
          normalizedKey,
          "Map_Disease_Drug"
        ),
        fetchGoogleServiceAccountRows(
          spreadsheetId,
          clientEmail,
          normalizedKey,
          "Map_Symptom_Drug"
        ),
      ])
      mappingRows = [
        ...dsRows.map((r) => ({ ...r, map_type: "disease_symptom" })),
        ...ddRows.map((r) => ({ ...r, map_type: "disease_drug" })),
        ...sdRows.map((r) => ({ ...r, map_type: "symptom_drug" })),
      ]
    }
    return {
      source: "google_sheets_api",
      sheetUrl,
      tabs: ["Disease", "Symptom", "Drug", "mappings"],
      diseaseRows,
      symptomRows,
      drugRows,
      mappingRows,
    }
  }

  if (apiKey && spreadsheetId) {
    const diseaseRows = await fetchGoogleApiRows(spreadsheetId, apiKey, "Disease")
    const symptomRows = await fetchGoogleApiRows(spreadsheetId, apiKey, "Symptom")
    const drugRows = await fetchGoogleApiRows(spreadsheetId, apiKey, "Drug")
    let mappingRows: ParsedCsvRow[] = []
    try {
      mappingRows = await fetchGoogleApiRows(spreadsheetId, apiKey, "mappings")
    } catch {
      const [dsRows, ddRows, sdRows] = await Promise.all([
        fetchGoogleApiRows(spreadsheetId, apiKey, "Map_Disease_Symptom"),
        fetchGoogleApiRows(spreadsheetId, apiKey, "Map_Disease_Drug"),
        fetchGoogleApiRows(spreadsheetId, apiKey, "Map_Symptom_Drug"),
      ])
      mappingRows = [
        ...dsRows.map((r) => ({ ...r, map_type: "disease_symptom" })),
        ...ddRows.map((r) => ({ ...r, map_type: "disease_drug" })),
        ...sdRows.map((r) => ({ ...r, map_type: "symptom_drug" })),
      ]
    }
    return {
      source: "google_sheets_api",
      sheetUrl,
      tabs: ["Disease", "Symptom", "Drug", "mappings"],
      diseaseRows,
      symptomRows,
      drugRows,
      mappingRows,
    }
  }

  const tabs = await getPublishedTabs(sheetUrl)
  // Published HTML often doesn't contain per-tab anchors anymore.
  // Prefer fetching CSV by sheet name, fall back to gid-based when available.
  const diseaseRows = tabs.has("disease")
    ? await fetchCsvTabRows(sheetUrl, tabs.get("disease") || "")
    : await fetchCsvSheetRows(sheetUrl, "Disease")
  const symptomRows = tabs.has("symptom")
    ? await fetchCsvTabRows(sheetUrl, tabs.get("symptom") || "")
    : await fetchCsvSheetRows(sheetUrl, "Symptom")
  const drugRows = tabs.has("drug")
    ? await fetchCsvTabRows(sheetUrl, tabs.get("drug") || "")
    : await fetchCsvSheetRows(sheetUrl, "Drug")
  if (diseaseRows.length === 0 || symptomRows.length === 0 || drugRows.length === 0) {
    throw new Error("Published Google Sheet ต้องมีแท็บ Disease/Symptom/Drug และต้องมี header แถวแรก")
  }
  let mappingRows: ParsedCsvRow[] = []

  // 1) unified mappings tab
  if (tabs.has("mappings")) {
    mappingRows = await fetchCsvTabRows(sheetUrl, tabs.get("mappings") || "")
  } else {
    mappingRows = await fetchCsvSheetRows(sheetUrl, "mappings").catch(() => [])
  }

  // 2) separate mapping tabs (only if unified not available)
  if (mappingRows.length === 0) {
    if (
      tabs.has("map_disease_symptom") &&
      tabs.has("map_disease_drug") &&
      tabs.has("map_symptom_drug")
    ) {
      const [dsRows, ddRows, sdRows] = await Promise.all([
        fetchCsvTabRows(sheetUrl, tabs.get("map_disease_symptom") || ""),
        fetchCsvTabRows(sheetUrl, tabs.get("map_disease_drug") || ""),
        fetchCsvTabRows(sheetUrl, tabs.get("map_symptom_drug") || ""),
      ])
      mappingRows = [
        ...dsRows.map((r) => ({ ...r, map_type: "disease_symptom" })),
        ...ddRows.map((r) => ({ ...r, map_type: "disease_drug" })),
        ...sdRows.map((r) => ({ ...r, map_type: "symptom_drug" })),
      ]
    } else {
      const [dsRows, ddRows, sdRows] = await Promise.all([
        fetchCsvSheetRows(sheetUrl, "Map_Disease_Symptom").catch(() => []),
        fetchCsvSheetRows(sheetUrl, "Map_Disease_Drug").catch(() => []),
        fetchCsvSheetRows(sheetUrl, "Map_Symptom_Drug").catch(() => []),
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
  return {
    source: "published_csv",
    sheetUrl,
    tabs: Array.from(tabs.keys()),
    diseaseRows,
    symptomRows,
    drugRows,
    mappingRows,
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
  const errors: SyncRowError[] = []
  const diseaseStats = counters()
  const symptomStats = counters()
  const drugStats = counters()
  const dsStats = counters()
  const ddStats = counters()
  const sdStats = counters()

  const sourceData = await loadSheetData()
  const { source, sheetUrl, tabs, diseaseRows, symptomRows, drugRows, mappingRows } =
    sourceData

  const [existingDiseases, existingSymptoms, existingDrugs] = await Promise.all([
    prisma.knowledgeDisease.findMany({ select: { id: true, slug: true } }),
    prisma.knowledgeSymptom.findMany({ select: { id: true, slug: true } }),
    prisma.drug.findMany({ select: { id: true, slug: true, slotId: true } }),
  ])

  const diseaseBySlug = new Map(existingDiseases.map((d) => [d.slug, d]))
  const symptomBySlug = new Map(existingSymptoms.map((s) => [s.slug, s]))
  const drugByRef = new Map<string, { id: string; slug: string | null; slotId: string }>()
  for (const d of existingDrugs) {
    drugByRef.set(d.id, d)
    drugByRef.set(d.slotId, d)
    if (d.slug) drugByRef.set(d.slug, d)
  }

  const incomingDiseaseSlugs = new Set<string>()
  const incomingSymptomSlugs = new Set<string>()
  const incomingDrugIds = new Set<string>()

  const mappingDiseaseSymptom: { diseaseId: string; symptomId: string; score: number; note: string }[] =
    []
  const mappingDiseaseDrug: {
    diseaseId: string
    drugId: string
    level: string
    note: string
  }[] = []
  const mappingSymptomDrug: {
    symptomId: string
    drugId: string
    level: string
    note: string
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
    const ref = row.drug_ref || row.slotid || row.slot_id || ""
    if (!ref) {
      drugStats.skipped += 1
      pushErr(errors, "Drug", idx + 2, "missing required field: drug_ref", row)
      continue
    }
    const found = drugByRef.get(ref)
    if (!found) {
      drugStats.skipped += 1
      pushErr(errors, "Drug", idx + 2, `drug_ref not found in DB: ${ref}`, row)
      continue
    }
    incomingDrugIds.add(found.id)
    drugStats.updated += 1
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
    const scoreRaw = row.score || row.relevance_score || ""
    const score = scoreRaw ? toInt(scoreRaw, 0) : 0
    const note = row.note || ""
    const level = row.recommendation_level || "SUGGESTED"

    if (!mapType || !left || !right) {
      if (Object.values(row).some((v) => String(v).trim())) {
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
      const disease = diseaseBySlug.get(left)
      const symptom = symptomBySlug.get(normalizeSlug(right))
      if (!disease || !symptom) {
        dsStats.skipped += 1
        pushErr(
          errors,
          "mappings",
          idx + 2,
          `mapping target not found (disease=${left}, symptom=${right})`,
          row
        )
        continue
      }
      dsStats.inserted += 1
      mappingDiseaseSymptom.push({
        diseaseId: disease.id,
        symptomId: symptom.id,
        score,
        note,
      })
    } else if (mapType === "disease_drug") {
      const disease = diseaseBySlug.get(left)
      const drug = drugByRef.get(normalizeSlug(right)) || drugByRef.get(right)
      if (!disease || !drug) {
        ddStats.skipped += 1
        pushErr(
          errors,
          "mappings",
          idx + 2,
          `mapping target not found (disease=${left}, drug=${right})`,
          row
        )
        continue
      }
      ddStats.inserted += 1
      mappingDiseaseDrug.push({
        diseaseId: disease.id,
        drugId: drug.id,
        level,
        note,
      })
    } else if (mapType === "symptom_drug") {
      const symptom = symptomBySlug.get(left)
      const drug = drugByRef.get(normalizeSlug(right)) || drugByRef.get(right)
      if (!symptom || !drug) {
        sdStats.skipped += 1
        pushErr(
          errors,
          "mappings",
          idx + 2,
          `mapping target not found (symptom=${left}, drug=${right})`,
          row
        )
        continue
      }
      sdStats.inserted += 1
      mappingSymptomDrug.push({
        symptomId: symptom.id,
        drugId: drug.id,
        level,
        note,
      })
    } else {
      pushErr(errors, "mappings", idx + 2, `unknown map_type: ${mapType}`, row)
    }
  }

  diseaseStats.deleted = existingDiseases.filter((d) => !incomingDiseaseSlugs.has(d.slug)).length
  symptomStats.deleted = existingSymptoms.filter((s) => !incomingSymptomSlugs.has(s.slug)).length
  drugStats.deleted = existingDrugs.filter((d) => !incomingDrugIds.has(d.id)).length
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
        const ref = row.drug_ref || row.slotid || row.slot_id || ""
        if (!ref) continue
        const found = await tx.drug.findFirst({
          where: { OR: [{ id: ref }, { slotId: ref }] },
        })
        if (!found) continue
        await tx.drug.update({
          where: { id: found.id },
          data: {
            slug: row.slug ? normalizeSlug(row.slug) : found.slug,
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

      if (mappingDiseaseSymptom.length > 0) {
        await tx.diseaseSymptomMap.createMany({
          data: mappingDiseaseSymptom.map((m) => ({
            diseaseId: m.diseaseId,
            symptomId: m.symptomId,
            relevanceScore: m.score,
            note: m.note,
          })),
        })
      }
      if (mappingDiseaseDrug.length > 0) {
        await tx.diseaseDrugMap.createMany({
          data: mappingDiseaseDrug.map((m) => ({
            diseaseId: m.diseaseId,
            drugId: m.drugId,
            recommendationLevel: m.level,
            note: m.note,
          })),
        })
      }
      if (mappingSymptomDrug.length > 0) {
        await tx.symptomDrugMap.createMany({
          data: mappingSymptomDrug.map((m) => ({
            symptomId: m.symptomId,
            drugId: m.drugId,
            recommendationLevel: m.level,
            note: m.note,
          })),
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
    diseaseSymptomMap: dsStats,
    diseaseDrugMap: ddStats,
    symptomDrugMap: sdStats,
    errors,
  }
}
