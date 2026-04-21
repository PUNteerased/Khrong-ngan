import type { Request, Response } from "express"
import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma.js"

export async function getMe(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }
  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
  })
  if (!user) {
    res.status(404).json({ error: "ไม่พบผู้ใช้" })
    return
  }
  res.json(serializeUser(user))
}

export async function patchMe(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }
  const {
    fullName,
    avatarUrl,
    age,
    weight,
    height,
    gender,
    allergiesText,
    allergyKeywords,
    noAllergies,
    diseasesText,
    noDiseases,
    currentMedications,
  } = req.body as Record<string, unknown>

  const data: Prisma.UserUpdateInput = {}
  if (fullName !== undefined) data.fullName = String(fullName)
  if (avatarUrl !== undefined)
    data.avatarUrl = avatarUrl ? String(avatarUrl) : null
  if (age !== undefined) data.age = age === null || age === "" ? null : Number(age)
  if (weight !== undefined)
    data.weight = weight === null || weight === "" ? null : Number(weight)
  if (height !== undefined)
    data.height = height === null || height === "" ? null : Number(height)
  if (gender !== undefined)
    data.gender =
      gender === null || String(gender).trim() === "" ? null : String(gender)
  if (allergiesText !== undefined) data.allergiesText = String(allergiesText)
  if (allergyKeywords !== undefined)
    data.allergyKeywords = String(allergyKeywords)
  if (noAllergies !== undefined) data.noAllergies = Boolean(noAllergies)
  if (diseasesText !== undefined) data.diseasesText = String(diseasesText)
  if (noDiseases !== undefined) data.noDiseases = Boolean(noDiseases)
  if (currentMedications !== undefined)
    data.currentMedications = String(currentMedications)

  const user = await prisma.user.update({
    where: { id: req.auth.userId },
    data,
  })

  res.json(serializeUser(user))
}

function serializeUser(user: {
  id: string
  username: string | null
  phone: string | null
  isAdmin: boolean
  fullName: string
  avatarUrl: string | null
  age: number | null
  weight: number | null
  height: number | null
  gender: string | null
  allergiesText: string
  allergyKeywords: string
  noAllergies: boolean
  diseasesText: string
  noDiseases: boolean
  currentMedications: string
}) {
  return {
    id: user.id,
    username: user.username ?? "",
    phone: user.phone ?? "",
    isAdmin: user.isAdmin,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    age: user.age,
    weight: user.weight,
    height: user.height,
    gender: user.gender,
    allergiesText: user.allergiesText,
    allergyKeywords: user.allergyKeywords,
    noAllergies: user.noAllergies,
    diseasesText: user.diseasesText,
    noDiseases: user.noDiseases,
    currentMedications: user.currentMedications,
  }
}
