import type { AppLang } from "./lang.js"
import { pickLang } from "./lang.js"

type DiseaseRow = {
  id: string
  slug: string
  nameTh: string
  nameEn: string | null
  definition: string
  definitionEn: string | null
  severityLevel: string
  selfCareAdvice?: string
  selfCareEn?: string | null
  redFlagAdvice?: string
  redFlagEn?: string | null
}

type SymptomRow = {
  id: string
  slug: string
  nameTh: string
  nameEn: string | null
  observationGuide: string
  observationEn: string | null
  dangerLevel: string
  redFlag: boolean
}

type DrugRow = {
  id: string
  slug: string | null
  name: string
  genericName: string | null
  brandName: string | null
  brandNameEn: string | null
  description: string
  indication: string | null
  indicationEn: string | null
  category: string | null
  slotId: string
  quantity: number
  imageUrl: string | null
}

export function projectDiseaseCard(d: DiseaseRow, lang: AppLang) {
  return {
    id: d.id,
    slug: d.slug,
    name: pickLang(lang, d.nameTh, d.nameEn),
    definition: pickLang(lang, d.definition, d.definitionEn),
    severityLevel: d.severityLevel,
    nameTh: d.nameTh,
    nameEn: d.nameEn,
    definitionTh: d.definition,
    definitionEn: d.definitionEn,
  }
}

export function projectSymptomCard(s: SymptomRow, lang: AppLang) {
  const obs = pickLang(lang, s.observationGuide, s.observationEn)
  return {
    id: s.id,
    slug: s.slug,
    name: pickLang(lang, s.nameTh, s.nameEn),
    observation: obs,
    observationGuide: obs,
    dangerLevel: s.dangerLevel,
    redFlag: s.redFlag,
    nameTh: s.nameTh,
    nameEn: s.nameEn,
    observationTh: s.observationGuide,
    observationEn: s.observationEn,
  }
}

export function projectDrugCard(d: DrugRow, lang: AppLang) {
  const nameEn = d.brandNameEn || d.genericName || null
  const descEn = d.indicationEn || d.description
  return {
    id: d.id,
    slug: d.slug,
    name: pickLang(lang, d.name, nameEn),
    description: pickLang(lang, d.description, descEn),
    genericName: d.genericName,
    category: d.category,
    slotId: d.slotId,
    quantity: d.quantity,
    imageUrl: d.imageUrl,
    inCabinet: d.quantity > 0,
  }
}

export function projectDiseaseDetail(
  row: DiseaseRow & {
    keywords: string
    isPublished: boolean
    createdAt: Date
    updatedAt: Date
  },
  lang: AppLang
) {
  const selfTh = row.selfCareAdvice ?? ""
  const selfEn = row.selfCareEn ?? null
  const redTh = row.redFlagAdvice ?? ""
  const redEn = row.redFlagEn ?? null
  return {
    id: row.id,
    slug: row.slug,
    name: pickLang(lang, row.nameTh, row.nameEn),
    definition: pickLang(lang, row.definition, row.definitionEn),
    selfCareAdvice: pickLang(lang, selfTh, selfEn),
    redFlagAdvice: pickLang(lang, redTh, redEn),
    severityLevel: row.severityLevel,
    nameTh: row.nameTh,
    nameEn: row.nameEn,
    definitionTh: row.definition,
    definitionEn: row.definitionEn,
    selfCareTh: selfTh,
    selfCareEn: selfEn,
    redFlagTh: redTh,
    redFlagEn: redEn,
    keywords: row.keywords,
    isPublished: row.isPublished,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function projectSymptomDetail(
  row: SymptomRow & {
    firstAid: string
    keywords: string
    isPublished: boolean
    createdAt: Date
    updatedAt: Date
  },
  lang: AppLang
) {
  const obs = pickLang(lang, row.observationGuide, row.observationEn)
  return {
    id: row.id,
    slug: row.slug,
    name: pickLang(lang, row.nameTh, row.nameEn),
    observation: obs,
    observationGuide: obs,
    firstAid: row.firstAid,
    dangerLevel: row.dangerLevel,
    redFlag: row.redFlag,
    nameTh: row.nameTh,
    nameEn: row.nameEn,
    observationTh: row.observationGuide,
    observationEn: row.observationEn,
    keywords: row.keywords,
    isPublished: row.isPublished,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function projectDiseaseRef(
  d: { id: string; slug: string; nameTh: string; nameEn: string | null; severityLevel?: string },
  lang: AppLang
) {
  return {
    id: d.id,
    slug: d.slug,
    name: pickLang(lang, d.nameTh, d.nameEn),
    nameTh: d.nameTh,
    nameEn: d.nameEn,
    severityLevel: d.severityLevel,
  }
}

export function projectSymptomRef(
  s: { id: string; slug: string; nameTh: string; nameEn: string | null; dangerLevel?: string; redFlag?: boolean },
  lang: AppLang
) {
  return {
    id: s.id,
    slug: s.slug,
    name: pickLang(lang, s.nameTh, s.nameEn),
    nameTh: s.nameTh,
    nameEn: s.nameEn,
    dangerLevel: s.dangerLevel,
    redFlag: s.redFlag,
  }
}

export function projectDrugDetail(
  drug: DrugRow & {
    contraindications: string | null
    doseByAgeWeight: string | null
    doseEn: string | null
    ingredientsText: string
    warnings: string | null
  },
  lang: AppLang
) {
  const nameEn = drug.brandNameEn || drug.genericName
  const indicationEn = drug.indicationEn || drug.indication
  const doseEn = drug.doseEn || drug.doseByAgeWeight
  return {
    id: drug.id,
    slug: drug.slug,
    name: pickLang(lang, drug.name, nameEn),
    description: pickLang(lang, drug.description, drug.indicationEn || drug.description),
    genericName: drug.genericName,
    brandName: pickLang(lang, drug.brandName || "", drug.brandNameEn),
    brandNameTh: drug.brandName,
    brandNameEn: drug.brandNameEn,
    indication: pickLang(lang, drug.indication || "", indicationEn),
    indicationTh: drug.indication,
    indicationEn: drug.indicationEn,
    contraindications: drug.contraindications,
    doseByAgeWeight: pickLang(lang, drug.doseByAgeWeight || "", doseEn),
    doseTh: drug.doseByAgeWeight,
    doseEn: drug.doseEn,
    ingredientsText: drug.ingredientsText,
    warnings: drug.warnings,
    category: drug.category,
    slotId: drug.slotId,
    quantity: drug.quantity,
    imageUrl: drug.imageUrl,
    inCabinet: drug.quantity > 0,
  }
}
