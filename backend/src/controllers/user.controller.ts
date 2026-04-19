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
  res.json({
    id: user.id,
    username: user.username ?? "",
    phone: user.phone ?? "",
    isAdmin: user.isAdmin,
    fullName: user.fullName,
    age: user.age,
    weight: user.weight,
    allergiesText: user.allergiesText,
    noAllergies: user.noAllergies,
    diseasesText: user.diseasesText,
    noDiseases: user.noDiseases,
  })
}

export async function patchMe(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }
  const {
    fullName,
    age,
    weight,
    allergiesText,
    noAllergies,
    diseasesText,
    noDiseases,
  } = req.body as Record<string, unknown>

  const data: Prisma.UserUpdateInput = {}
  if (fullName !== undefined) data.fullName = String(fullName)
  if (age !== undefined) data.age = age === null || age === "" ? null : Number(age)
  if (weight !== undefined)
    data.weight = weight === null || weight === "" ? null : Number(weight)
  if (allergiesText !== undefined) data.allergiesText = String(allergiesText)
  if (noAllergies !== undefined) data.noAllergies = Boolean(noAllergies)
  if (diseasesText !== undefined) data.diseasesText = String(diseasesText)
  if (noDiseases !== undefined) data.noDiseases = Boolean(noDiseases)

  const user = await prisma.user.update({
    where: { id: req.auth.userId },
    data,
  })

  res.json({
    id: user.id,
    username: user.username ?? "",
    phone: user.phone ?? "",
    isAdmin: user.isAdmin,
    fullName: user.fullName,
    age: user.age,
    weight: user.weight,
    allergiesText: user.allergiesText,
    noAllergies: user.noAllergies,
    diseasesText: user.diseasesText,
    noDiseases: user.noDiseases,
  })
}
