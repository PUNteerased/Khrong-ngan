export type SafetyCheckResult = {
  isSafe: boolean
  matchedAllergies: string[]
  checkedAllergies: string[]
  checkedIngredients: string[]
}

function toKeywords(input: string | null | undefined): string[] {
  if (!input) return []
  return Array.from(
    new Set(
      input
        .toLowerCase()
        .split(/[,\n;/|]+/g)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  )
}

export function parseAllergyKeywords(user: {
  noAllergies?: boolean | null
  allergyKeywords?: string | null
  allergiesText?: string | null
}): string[] {
  if (user.noAllergies) return []
  const strictKeywords = toKeywords(user.allergyKeywords)
  if (strictKeywords.length > 0) return strictKeywords
  return toKeywords(user.allergiesText)
}

export function checkDrugSafety(args: {
  userAllergyKeywords: string[]
  drugIngredientsText?: string | null
}): SafetyCheckResult {
  const checkedAllergies = Array.from(new Set(args.userAllergyKeywords.map((v) => v.toLowerCase().trim()).filter(Boolean)))
  const checkedIngredients = toKeywords(args.drugIngredientsText ?? "")

  const matchedAllergies = checkedAllergies.filter((allergy) =>
    checkedIngredients.some(
      (ingredient) =>
        ingredient.includes(allergy) || allergy.includes(ingredient)
    )
  )

  return {
    isSafe: matchedAllergies.length === 0,
    matchedAllergies,
    checkedAllergies,
    checkedIngredients,
  }
}

/**
 * Finds drugs mentioned in free-form text (e.g. AI answer). Matches on
 * drug.name as well as any keyword in drug.ingredientsText. Case-insensitive.
 */
export function findMentionedDrugs<
  T extends { id: string; name: string; ingredientsText?: string | null }
>(text: string, drugs: T[]): T[] {
  if (!text) return []
  const haystack = text.toLowerCase()
  const mentioned = new Map<string, T>()
  for (const d of drugs) {
    const name = d.name?.trim().toLowerCase()
    if (name && name.length >= 3 && haystack.includes(name)) {
      mentioned.set(d.id, d)
      continue
    }
    const ingredients = toKeywords(d.ingredientsText ?? "")
    for (const kw of ingredients) {
      if (kw.length >= 4 && haystack.includes(kw)) {
        mentioned.set(d.id, d)
        break
      }
    }
  }
  return Array.from(mentioned.values())
}
