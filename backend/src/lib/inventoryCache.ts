import { prisma } from "./prisma.js"

const TTL_MS = 60_000
let cachedText: string | null = null
let cachedAt = 0

async function loadInventoryDrugsInput(): Promise<string> {
  const drugs = await prisma.drug.findMany({
    where: { quantity: { gt: 0 } },
    orderBy: { slotId: "asc" },
    select: {
      slotId: true,
      name: true,
      quantity: true,
      ingredientsText: true,
      category: true,
    },
  })
  if (drugs.length === 0) return "ไม่มียาในตู้ขณะนี้"
  return drugs
    .map((d) => {
      const ing = d.ingredientsText.trim() || "-"
      const cat = d.category?.trim() || "-"
      return `- ${d.slotId} | ${d.name} | stock: ${d.quantity} | category: ${cat} | ingredients: ${ing}`
    })
    .join("\n")
}

export function invalidateInventoryCache(): void {
  cachedText = null
  cachedAt = 0
}

export async function getInventoryDrugsInput(): Promise<string> {
  const now = Date.now()
  if (cachedText != null && now - cachedAt < TTL_MS) {
    return cachedText
  }
  cachedText = await loadInventoryDrugsInput()
  cachedAt = now
  return cachedText
}
