import type { Request, Response } from "express"
import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma.js"
import { syncKnowledgeFromSheet } from "../services/knowledgeSheetSync.service.js"
import { parseLangQuery } from "../utils/lang.js"
import {
  projectDiseaseCard,
  projectDiseaseDetail,
  projectDiseaseRef,
  projectDrugCard,
  projectDrugDetail,
  projectSymptomCard,
  projectSymptomDetail,
  projectSymptomRef,
} from "../utils/knowledgeProjection.js"

function normalizeQuery(q: string): string {
  return q.trim()
}

export async function searchKnowledge(req: Request, res: Response) {
  const lang = parseLangQuery(req)
  const q = normalizeQuery(String(req.query.q || ""))
  const whereContains = q
    ? {
        OR: [
          { nameTh: { contains: q } },
          { nameEn: { contains: q } },
          { definition: { contains: q } },
          { definitionEn: { contains: q } },
          { keywords: { contains: q } },
        ],
      }
    : {}
  const diseaseWhere = { isPublished: true, ...whereContains }
  const symptomWhere = q
    ? {
        isPublished: true,
        OR: [
          { nameTh: { contains: q } },
          { nameEn: { contains: q } },
          { observationGuide: { contains: q } },
          { observationEn: { contains: q } },
          { keywords: { contains: q } },
        ],
      }
    : { isPublished: true }
  const drugWhere = q
    ? {
        isPublished: true,
        OR: [
          { name: { contains: q } },
          { genericName: { contains: q } },
          { brandName: { contains: q } },
          { brandNameEn: { contains: q } },
          { description: { contains: q } },
          { indication: { contains: q } },
          { indicationEn: { contains: q } },
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
        definitionEn: true,
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
        observationEn: true,
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
        brandName: true,
        brandNameEn: true,
        description: true,
        indication: true,
        indicationEn: true,
        category: true,
        slotId: true,
        quantity: true,
        imageUrl: true,
      },
    }),
  ])

  res.json({
    diseases: diseases.map((d) => projectDiseaseCard(d, lang)),
    symptoms: symptoms.map((s) => projectSymptomCard(s, lang)),
    drugs: drugs.map((d) => projectDrugCard(d, lang)),
  })
}

export async function listDiseases(req: Request, res: Response) {
  const lang = parseLangQuery(req)
  const rows = await prisma.knowledgeDisease.findMany({
    where: { isPublished: true },
    orderBy: [{ severityLevel: "desc" }, { nameTh: "asc" }],
    select: {
      id: true,
      slug: true,
      nameTh: true,
      nameEn: true,
      definition: true,
      definitionEn: true,
      severityLevel: true,
    },
  })
  res.json(rows.map((d) => projectDiseaseCard(d, lang)))
}

export async function listSymptoms(req: Request, res: Response) {
  const lang = parseLangQuery(req)
  const rows = await prisma.knowledgeSymptom.findMany({
    where: { isPublished: true },
    orderBy: [{ dangerLevel: "desc" }, { nameTh: "asc" }],
    select: {
      id: true,
      slug: true,
      nameTh: true,
      nameEn: true,
      observationGuide: true,
      observationEn: true,
      dangerLevel: true,
      redFlag: true,
    },
  })
  res.json(rows.map((s) => projectSymptomCard(s, lang)))
}

export async function listKnowledgeDrugs(req: Request, res: Response) {
  const lang = parseLangQuery(req)
  const rows = await prisma.drug.findMany({
    where: { isPublished: true },
    orderBy: [{ knowledgePriority: "desc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      genericName: true,
      brandName: true,
      brandNameEn: true,
      description: true,
      indication: true,
      indicationEn: true,
      category: true,
      slotId: true,
      quantity: true,
      imageUrl: true,
    },
  })
  res.json(rows.map((d) => projectDrugCard(d, lang)))
}

export async function getDiseaseDetail(req: Request, res: Response) {
  const lang = parseLangQuery(req)
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
              brandName: true,
              brandNameEn: true,
              description: true,
              indication: true,
              indicationEn: true,
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
  const { symptomMaps, drugMaps, ...entity } = row
  res.json({
    ...projectDiseaseDetail(entity, lang),
    relatedSymptoms: symptomMaps.map((m) => ({
      ...projectSymptomRef(m.symptom, lang),
      relevanceScore: m.relevanceScore,
      note: m.note,
    })),
    suggestedDrugs: drugMaps.map((m) => ({
      ...projectDrugCard(m.drug, lang),
      recommendationLevel: m.recommendationLevel,
      note: m.note,
    })),
  })
}

export async function getSymptomDetail(req: Request, res: Response) {
  const lang = parseLangQuery(req)
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
              brandName: true,
              brandNameEn: true,
              description: true,
              indication: true,
              indicationEn: true,
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
  const { diseaseMaps, drugMaps, ...entity } = row
  res.json({
    ...projectSymptomDetail(entity, lang),
    possibleDiseases: diseaseMaps.map((m) => ({
      ...projectDiseaseRef(m.disease, lang),
      relevanceScore: m.relevanceScore,
      note: m.note,
    })),
    reliefDrugs: drugMaps.map((m) => ({
      ...projectDrugCard(m.drug, lang),
      recommendationLevel: m.recommendationLevel,
      note: m.note,
    })),
  })
}

export async function getKnowledgeDrugDetail(req: Request, res: Response) {
  const lang = parseLangQuery(req)
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
  const { diseaseMaps, symptomMaps, ...drugEntity } = drug
  res.json({
    ...projectDrugDetail(drugEntity, lang),
    treatsDiseases: diseaseMaps.map((m) => ({
      ...projectDiseaseRef(m.disease, lang),
      recommendationLevel: m.recommendationLevel,
      note: m.note,
    })),
    relievesSymptoms: symptomMaps.map((m) => ({
      ...projectSymptomRef(m.symptom, lang),
      recommendationLevel: m.recommendationLevel,
      note: m.note,
    })),
  })
}

async function writeSyncLog(
  req: Request,
  params: {
    mode: "dry_run" | "commit"
    status: "success" | "failed"
    summary?: unknown
    errors?: unknown
  }
) {
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
