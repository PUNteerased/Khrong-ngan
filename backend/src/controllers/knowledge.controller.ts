import type { Request, Response } from "express"
import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma.js"
import { syncKnowledgeFromSheet } from "../services/knowledgeSheetSync.service.js"

function normalizeQuery(q: string): string {
  return q.trim()
}

function drugLite(d: {
  id: string
  slug: string | null
  name: string
  genericName: string | null
  description: string
  category: string | null
  slotId: string
  quantity: number
  imageUrl: string | null
}): Record<string, unknown> {
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    genericName: d.genericName,
    description: d.description,
    category: d.category,
    slotId: d.slotId,
    quantity: d.quantity,
    imageUrl: d.imageUrl,
    inCabinet: d.quantity > 0,
  }
}

export async function searchKnowledge(req: Request, res: Response) {
  const q = normalizeQuery(String(req.query.q || ""))
  const whereContains = q
    ? {
        OR: [
          { nameTh: { contains: q } },
          { nameEn: { contains: q } },
          { keywords: { contains: q } },
        ],
      }
    : {}
  const diseaseWhere = { isPublished: true, ...whereContains }
  const symptomWhere = { isPublished: true, ...whereContains }
  const drugWhere = q
    ? {
        isPublished: true,
        OR: [
          { name: { contains: q } },
          { genericName: { contains: q } },
          { brandName: { contains: q } },
          { description: { contains: q } },
          { keywords: { contains: q } },
        ],
      }
    : { isPublished: true }

  const [diseases, symptoms, drugs] = await Promise.all([
    prisma.knowledgeDisease.findMany({
      where: diseaseWhere,
      orderBy: [{ severityLevel: "desc" }, { nameTh: "asc" }],
      take: 50,
      select: {
        id: true,
        slug: true,
        nameTh: true,
        nameEn: true,
        definition: true,
        severityLevel: true,
      },
    }),
    prisma.knowledgeSymptom.findMany({
      where: symptomWhere,
      orderBy: [{ dangerLevel: "desc" }, { nameTh: "asc" }],
      take: 50,
      select: {
        id: true,
        slug: true,
        nameTh: true,
        nameEn: true,
        observationGuide: true,
        dangerLevel: true,
        redFlag: true,
      },
    }),
    prisma.drug.findMany({
      where: drugWhere,
      orderBy: [{ knowledgePriority: "desc" }, { name: "asc" }],
      take: 50,
      select: {
        id: true,
        slug: true,
        name: true,
        genericName: true,
        description: true,
        category: true,
        slotId: true,
        quantity: true,
        imageUrl: true,
      },
    }),
  ])

  res.json({
    diseases,
    symptoms,
    drugs: drugs.map(drugLite),
  })
}

export async function listDiseases(_req: Request, res: Response) {
  const rows = await prisma.knowledgeDisease.findMany({
    where: { isPublished: true },
    orderBy: [{ severityLevel: "desc" }, { nameTh: "asc" }],
    select: {
      id: true,
      slug: true,
      nameTh: true,
      nameEn: true,
      definition: true,
      severityLevel: true,
    },
  })
  res.json(rows)
}

export async function listSymptoms(_req: Request, res: Response) {
  const rows = await prisma.knowledgeSymptom.findMany({
    where: { isPublished: true },
    orderBy: [{ dangerLevel: "desc" }, { nameTh: "asc" }],
    select: {
      id: true,
      slug: true,
      nameTh: true,
      nameEn: true,
      observationGuide: true,
      dangerLevel: true,
      redFlag: true,
    },
  })
  res.json(rows)
}

export async function listKnowledgeDrugs(_req: Request, res: Response) {
  const rows = await prisma.drug.findMany({
    where: { isPublished: true },
    orderBy: [{ knowledgePriority: "desc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      genericName: true,
      description: true,
      category: true,
      slotId: true,
      quantity: true,
      imageUrl: true,
    },
  })
  res.json(rows.map(drugLite))
}

export async function getDiseaseDetail(req: Request, res: Response) {
  const slug = String(req.params.slug)
  const row = await prisma.knowledgeDisease.findUnique({
    where: { slug },
    include: {
      symptomMaps: {
        include: {
          symptom: {
            select: {
              id: true,
              slug: true,
              nameTh: true,
              nameEn: true,
              dangerLevel: true,
              redFlag: true,
            },
          },
        },
        orderBy: [{ relevanceScore: "desc" }],
      },
      drugMaps: {
        include: {
          drug: {
            select: {
              id: true,
              slug: true,
              name: true,
              genericName: true,
              description: true,
              category: true,
              slotId: true,
              quantity: true,
              imageUrl: true,
            },
          },
        },
      },
    },
  })
  if (!row || !row.isPublished) {
    res.status(404).json({ error: "ไม่พบข้อมูลโรค" })
    return
  }
  res.json({
    ...row,
    relatedSymptoms: row.symptomMaps.map((m) => ({
      ...m.symptom,
      relevanceScore: m.relevanceScore,
      note: m.note,
    })),
    suggestedDrugs: row.drugMaps.map((m) => ({
      ...drugLite(m.drug),
      recommendationLevel: m.recommendationLevel,
      note: m.note,
    })),
  })
}

export async function getSymptomDetail(req: Request, res: Response) {
  const slug = String(req.params.slug)
  const row = await prisma.knowledgeSymptom.findUnique({
    where: { slug },
    include: {
      diseaseMaps: {
        include: {
          disease: {
            select: {
              id: true,
              slug: true,
              nameTh: true,
              nameEn: true,
              severityLevel: true,
            },
          },
        },
        orderBy: [{ relevanceScore: "desc" }],
      },
      drugMaps: {
        include: {
          drug: {
            select: {
              id: true,
              slug: true,
              name: true,
              genericName: true,
              description: true,
              category: true,
              slotId: true,
              quantity: true,
              imageUrl: true,
            },
          },
        },
      },
    },
  })
  if (!row || !row.isPublished) {
    res.status(404).json({ error: "ไม่พบข้อมูลอาการ" })
    return
  }
  res.json({
    ...row,
    possibleDiseases: row.diseaseMaps.map((m) => ({
      ...m.disease,
      relevanceScore: m.relevanceScore,
      note: m.note,
    })),
    reliefDrugs: row.drugMaps.map((m) => ({
      ...drugLite(m.drug),
      recommendationLevel: m.recommendationLevel,
      note: m.note,
    })),
  })
}

export async function getKnowledgeDrugDetail(req: Request, res: Response) {
  const key = String(req.params.idOrSlug)
  const drug = await prisma.drug.findFirst({
    where: {
      AND: [
        { isPublished: true },
        {
          OR: [{ id: key }, { slug: key }],
        },
      ],
    },
    include: {
      diseaseMaps: {
        include: {
          disease: {
            select: {
              id: true,
              slug: true,
              nameTh: true,
              nameEn: true,
              severityLevel: true,
            },
          },
        },
      },
      symptomMaps: {
        include: {
          symptom: {
            select: {
              id: true,
              slug: true,
              nameTh: true,
              nameEn: true,
              dangerLevel: true,
              redFlag: true,
            },
          },
        },
      },
    },
  })
  if (!drug) {
    res.status(404).json({ error: "ไม่พบข้อมูลยา" })
    return
  }
  res.json({
    ...drugLite(drug),
    genericName: drug.genericName,
    brandName: drug.brandName,
    indication: drug.indication,
    contraindications: drug.contraindications,
    doseByAgeWeight: drug.doseByAgeWeight,
    ingredientsText: drug.ingredientsText,
    warnings: drug.warnings,
    treatsDiseases: drug.diseaseMaps.map((m) => ({
      ...m.disease,
      recommendationLevel: m.recommendationLevel,
      note: m.note,
    })),
    relievesSymptoms: drug.symptomMaps.map((m) => ({
      ...m.symptom,
      recommendationLevel: m.recommendationLevel,
      note: m.note,
    })),
  })
}

async function writeSyncLog(req: Request, params: {
  mode: "dry_run" | "commit"
  status: "success" | "failed"
  summary?: unknown
  errors?: unknown
}) {
  let operatorUsername: string | null = null
  if (req.adminAuth?.userId) {
    const u = await prisma.user.findUnique({
      where: { id: req.adminAuth.userId },
      select: { username: true },
    })
    operatorUsername = u?.username || null
  }
  const data: Prisma.SyncLogCreateInput = {
    operatorUserId: req.adminAuth?.userId ?? null,
    operatorUsername,
    mode: params.mode,
    status: params.status,
  }
  if (params.summary !== undefined) {
    data.summary = params.summary as Prisma.InputJsonValue
  }
  if (params.errors !== undefined) {
    data.errors = params.errors as Prisma.InputJsonValue
  }
  await prisma.syncLog.create({
    data,
  })
}

export async function dryRunKnowledgeSheetSync(req: Request, res: Response) {
  try {
    const result = await syncKnowledgeFromSheet({ dryRun: true })
    await writeSyncLog(req, {
      mode: "dry_run",
      status: result.errors.length > 0 ? "failed" : "success",
      summary: result,
      errors: result.errors,
    })
    res.json({ ok: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync ไม่สำเร็จ"
    await writeSyncLog(req, {
      mode: "dry_run",
      status: "failed",
      errors: [{ message }],
    })
    res.status(400).json({ error: message })
  }
}

export async function syncKnowledgeSheet(req: Request, res: Response) {
  try {
    const preview = await syncKnowledgeFromSheet({ dryRun: true })
    if (preview.errors.length > 0) {
      await writeSyncLog(req, {
        mode: "commit",
        status: "failed",
        summary: preview,
        errors: preview.errors,
      })
      res.status(400).json({
        error: "validation failed",
        result: preview,
      })
      return
    }
    const result = await syncKnowledgeFromSheet({ dryRun: false })
    await writeSyncLog(req, {
      mode: "commit",
      status: "success",
      summary: result,
      errors: result.errors,
    })
    res.json({ ok: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync ไม่สำเร็จ"
    await writeSyncLog(req, {
      mode: "commit",
      status: "failed",
      errors: [{ message }],
    })
    res.status(400).json({ error: message })
  }
}

export async function getKnowledgeSyncStatus(_req: Request, res: Response) {
  const lastSuccess = await prisma.syncLog.findFirst({
    where: { mode: "commit", status: "success" },
    orderBy: { createdAt: "desc" },
  })
  const recent = await prisma.syncLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      mode: true,
      status: true,
      operatorUserId: true,
      createdAt: true,
      summary: true,
      errors: true,
    },
  })
  res.json({
    lastSuccessfulSyncAt: lastSuccess?.createdAt?.toISOString() || null,
    recent,
  })
}
