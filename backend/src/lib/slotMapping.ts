/** Cabinet slot labels A1–A5, B1–B5 map to PCA9685 channels 0–9. */

const SLOT_IDS = [
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "B1",
  "B2",
  "B3",
  "B4",
  "B5",
] as const

export type CabinetSlotId = (typeof SLOT_IDS)[number]

const SLOT_TO_CHANNEL: Record<CabinetSlotId, number> = {
  A1: 0,
  A2: 1,
  A3: 2,
  A4: 3,
  A5: 4,
  B1: 5,
  B2: 6,
  B3: 7,
  B4: 8,
  B5: 9,
}

export function isValidSlotId(slotId: string): slotId is CabinetSlotId {
  return (SLOT_IDS as readonly string[]).includes(slotId.toUpperCase())
}

export function slotIdToChannel(slotId: string): number | null {
  const key = slotId.toUpperCase()
  if (!isValidSlotId(key)) return null
  return SLOT_TO_CHANNEL[key]
}

export function channelToSlotId(channel: number): CabinetSlotId | null {
  if (!Number.isInteger(channel) || channel < 0 || channel > 9) return null
  return SLOT_IDS[channel] ?? null
}

export function listCabinetSlots(): CabinetSlotId[] {
  return [...SLOT_IDS]
}
