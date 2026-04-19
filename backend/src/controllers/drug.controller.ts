import type { Request, Response } from "express"
import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma.js"

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

  res.json(
    drugs.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      slotId: d.slotId,
      quantity: d.quantity,
      category: d.category,
      dosageNotes: d.dosageNotes,
      warnings: d.warnings,
      inCabinet: d.quantity > 0,
    }))
  )
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
  res.json({
    id: drug.id,
    name: drug.name,
    description: drug.description,
    slotId: drug.slotId,
    quantity: drug.quantity,
    category: drug.category,
    dosageNotes: drug.dosageNotes,
    warnings: drug.warnings,
    inCabinet: drug.quantity > 0,
  })
}

export async function createDrug(req: Request, res: Response) {
  const { name, description, slotId, quantity, category, dosageNotes, warnings } =
    req.body as Record<string, unknown>
  if (!name || !description || !slotId) {
    res.status(400).json({ error: "กรุณากรอก name, description, slotId" })
    return
  }
  try {
    const drug = await prisma.drug.create({
      data: {
        name: String(name),
        description: String(description),
        slotId: String(slotId),
        quantity: quantity != null ? Number(quantity) : 0,
        category: category != null ? String(category) : null,
        dosageNotes: dosageNotes != null ? String(dosageNotes) : null,
        warnings: warnings != null ? String(warnings) : null,
      },
    })
    res.status(201).json(drug)
  } catch {
    res.status(400).json({ error: "สร้างไม่สำเร็จ (slot ซ้ำ?)" })
  }
}

export async function patchDrug(req: Request, res: Response) {
  const { name, description, quantity, category, dosageNotes, warnings } =
    req.body as Record<string, unknown>
  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = String(name)
  if (description !== undefined) data.description = String(description)
  if (quantity !== undefined) data.quantity = Number(quantity)
  if (category !== undefined) data.category = category ? String(category) : null
  if (dosageNotes !== undefined)
    data.dosageNotes = dosageNotes ? String(dosageNotes) : null
  if (warnings !== undefined) data.warnings = warnings ? String(warnings) : null

  try {
    const drug = await prisma.drug.update({
      where: { id: String(req.params.id) },
      data: data as Parameters<typeof prisma.drug.update>[0]["data"],
    })
    res.json(drug)
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
  res.json(updated)
}

export async function deleteDrug(req: Request, res: Response) {
  try {
    await prisma.drug.delete({ where: { id: String(req.params.id) } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: "ไม่พบยา" })
  }
}
