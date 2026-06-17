import type { Request, Response } from "express"
import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma.js"
import { checkDrugSafety, parseAllergyKeywords } from "../lib/safetyCheck.js"

function serializeDrug(d: {
  id: string
  slug: string | null
  name: string
  genericName: string | null
  brandName: string | null
  description: string
  indication: string | null
  contraindications: string | null
  doseByAgeWeight: string | null
  slotId: string
  quantity: number
  category: string | null
  knowledgePriority: number
  isPublished: boolean
  keywords: string
  dosageNotes: string | null
  warnings: string | null
  ingredientsText: string
  imageUrl: string | null
  expiresAt: Date | null
  priceCents: number | null
}) {
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    genericName: d.genericName,
    brandName: d.brandName,
    description: d.description,
    indication: d.indication,
    contraindications: d.contraindications,
    doseByAgeWeight: d.doseByAgeWeight,
    slotId: d.slotId,
    quantity: d.quantity,
    category: d.category,
    knowledgePriority: d.knowledgePriority,
    isPublished: d.isPublished,
    keywords: d.keywords,
    dosageNotes: d.dosageNotes,
    warnings: d.warnings,
    ingredientsText: d.ingredientsText,
    imageUrl: d.imageUrl,
    expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
    priceCents: d.priceCents,
    inCabinet: d.quantity > 0,
  }
}

export async function listDrugs(req: Request, res: Response) {
  const search = (req.query.search as string) || ""
  const category = (req.query.category as string) || ""

  const where: Prisma.DrugWhereInput = {}
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
    ]
  }
  if (category) {
    where.category = { contains: category }
  }

  const drugs = await prisma.drug.findMany({
    where,
    orderBy: { slotId: "asc" },
  })

  res.json(drugs.map(serializeDrug))
}

export async function getDrug(req: Request, res: Response) {
  const id = String(req.params.id)
  const drug = await prisma.drug.findUnique({
    where: { id },
  })
  if (!drug) {
    res.status(404).json({ error: "ไม่พบยา" })
    return
  }
  res.json(serializeDrug(drug))
}

export async function createDrug(req: Request, res: Response) {
  const {
    name,
    slug,
    genericName,
    brandName,
    description,
    indication,
    contraindications,
    doseByAgeWeight,
    slotId,
    quantity,
    category,
    knowledgePriority,
    isPublished,
    keywords,
    dosageNotes,
    warnings,
    ingredientsText,
    imageUrl,
    expiresAt,
    priceCents,
  } = req.body as Record<string, unknown>
  if (!name || !description || !slotId) {
    res.status(400).json({ error: "กรุณากรอก name, description, slotId" })
    return
  }
  let expires: Date | null = null
  if (expiresAt != null && String(expiresAt).trim()) {
    const d = new Date(String(expiresAt))
    expires = Number.isNaN(d.getTime()) ? null : d
  }
  const price =
    priceCents != null && priceCents !== ""
      ? Math.max(0, Math.floor(Number(priceCents)))
      : null
  try {
    const drug = await prisma.drug.create({
      data: {
        name: String(name),
        slug: slug != null && String(slug).trim() ? String(slug) : null,
        genericName: genericName != null ? String(genericName) : null,
        brandName: brandName != null ? String(brandName) : null,
        description: String(description),
        indication: indication != null ? String(indication) : null,
        contraindications:
          contraindications != null ? String(contraindications) : null,
        doseByAgeWeight:
          doseByAgeWeight != null ? String(doseByAgeWeight) : null,
        slotId: String(slotId),
        quantity: quantity != null ? Number(quantity) : 0,
        category: category != null ? String(category) : null,
        knowledgePriority:
          knowledgePriority != null ? Number(knowledgePriority) : 0,
        isPublished:
          isPublished != null ? Boolean(isPublished) : true,
        keywords: keywords != null ? String(keywords) : "",
        dosageNotes: dosageNotes != null ? String(dosageNotes) : null,
        warnings: warnings != null ? String(warnings) : null,
        ingredientsText:
          ingredientsText != null ? String(ingredientsText) : "",
        imageUrl:
          imageUrl != null && String(imageUrl).trim() ? String(imageUrl) : null,
        expiresAt: expires,
        priceCents: price,
      },
    })
    res.status(201).json(serializeDrug(drug))
  } catch {
    res.status(400).json({ error: "สร้างไม่สำเร็จ (slot ซ้ำ?)" })
  }
}

export async function patchDrug(req: Request, res: Response) {
  const {
    name,
    slug,
    genericName,
    brandName,
    description,
    indication,
    contraindications,
    doseByAgeWeight,
    quantity,
    category,
    knowledgePriority,
    isPublished,
    keywords,
    dosageNotes,
    warnings,
    ingredientsText,
    imageUrl,
    slotId,
    expiresAt,
    priceCents,
  } = req.body as Record<string, unknown>
  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = String(name)
  if (slug !== undefined) data.slug = slug ? String(slug) : null
  if (genericName !== undefined)
    data.genericName = genericName ? String(genericName) : null
  if (brandName !== undefined) data.brandName = brandName ? String(brandName) : null
  if (description !== undefined) data.description = String(description)
  if (indication !== undefined) data.indication = indication ? String(indication) : null
  if (contraindications !== undefined)
    data.contraindications = contraindications ? String(contraindications) : null
  if (doseByAgeWeight !== undefined)
    data.doseByAgeWeight = doseByAgeWeight ? String(doseByAgeWeight) : null
  if (quantity !== undefined) data.quantity = Number(quantity)
  if (category !== undefined) data.category = category ? String(category) : null
  if (knowledgePriority !== undefined)
    data.knowledgePriority = Number(knowledgePriority)
  if (isPublished !== undefined) data.isPublished = Boolean(isPublished)
  if (keywords !== undefined) data.keywords = String(keywords)
  if (dosageNotes !== undefined)
    data.dosageNotes = dosageNotes ? String(dosageNotes) : null
  if (warnings !== undefined) data.warnings = warnings ? String(warnings) : null
  if (ingredientsText !== undefined)
    data.ingredientsText = String(ingredientsText)
  if (imageUrl !== undefined)
    data.imageUrl = imageUrl ? String(imageUrl) : null
  if (slotId !== undefined) data.slotId = String(slotId)
  if (expiresAt !== undefined) {
    if (expiresAt === null || expiresAt === "") data.expiresAt = null
    else {
      const d = new Date(String(expiresAt))
      data.expiresAt = Number.isNaN(d.getTime()) ? null : d
    }
  }
  if (priceCents !== undefined) {
    if (priceCents === null || priceCents === "") data.priceCents = null
    else data.priceCents = Math.max(0, Math.floor(Number(priceCents)))
  }

  try {
    const drug = await prisma.drug.update({
      where: { id: String(req.params.id) },
      data: data as Parameters<typeof prisma.drug.update>[0]["data"],
    })
    res.json(serializeDrug(drug))
  } catch {
    res.status(404).json({ error: "ไม่พบยา" })
  }
}

/** เติมสต็อก: body { add: number } หรือ { quantity: number } */
export async function restockDrug(req: Request, res: Response) {
  const { add, quantity } = req.body as { add?: number; quantity?: number }
  const id = String(req.params.id)
  const drug = await prisma.drug.findUnique({ where: { id } })
  if (!drug) {
    res.status(404).json({ error: "ไม่พบยา" })
    return
  }
  let next = drug.quantity
  if (typeof add === "number" && !Number.isNaN(add)) next += add
  else if (typeof quantity === "number" && !Number.isNaN(quantity))
    next = quantity
  else {
    res.status(400).json({ error: "ส่ง add หรือ quantity" })
    return
  }
  const updated = await prisma.drug.update({
    where: { id },
    data: { quantity: Math.max(0, next) },
  })
  res.json(serializeDrug(updated))
}

export async function deleteDrug(req: Request, res: Response) {
  try {
    await prisma.drug.delete({ where: { id: String(req.params.id) } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: "ไม่พบยา" })
  }
}

export async function getDrugSafetyCheck(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }
  const drugId = String(req.params.id)
  const [user, drug] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.auth.userId } }),
    prisma.drug.findUnique({ where: { id: drugId } }),
  ])

  if (!user) {
    res.status(404).json({ error: "ไม่พบผู้ใช้" })
    return
  }
  if (!drug) {
    res.status(404).json({ error: "ไม่พบยา" })
    return
  }

  const userAllergyKeywords = parseAllergyKeywords({
    noAllergies: user.noAllergies,
    allergyKeywords: user.allergyKeywords,
    allergiesText: user.allergiesText,
  })
  const result = checkDrugSafety({
    userAllergyKeywords,
    drugIngredientsText: drug.ingredientsText,
  })

  res.json({
    drugId: drug.id,
    drugName: drug.name,
    ingredientsText: drug.ingredientsText,
    ...result,
  })
}
