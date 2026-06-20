import { createHmac, randomBytes } from "crypto"
import { PickupTicketStatus, PickupStatus, type Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma.js"
import { slotIdToChannel, isValidSlotId } from "../lib/slotMapping.js"
import type { DifyRiskLevel } from "../lib/difyStructured.js"

const TICKET_TTL_MS = 15 * 60 * 1000

function ticketSecret(): string {
  const s = process.env.PICKUP_TICKET_SECRET?.trim()
  if (!s) return process.env.KIOSK_HEARTBEAT_SECRET?.trim() || "dev-ticket-secret"
  return s
}

function signPayload(payload: string): string {
  return createHmac("sha256", ticketSecret()).update(payload).digest("hex")
}

function buildTicketCode(slotId: string): string {
  const rand = randomBytes(3).toString("hex").toUpperCase()
  return `LNY-${slotId}-${rand}`
}

export type IssueTicketInput = {
  sessionId: string
  drugId: string
  slotId: string
  quantity?: number
  riskLevel?: DifyRiskLevel
}

export async function issuePickupTicket(input: IssueTicketInput) {
  const slotKey = input.slotId.toUpperCase()
  if (!isValidSlotId(slotKey)) {
    throw new Error("INVALID_SLOT")
  }
  const channel = slotIdToChannel(slotKey)
  if (channel == null) throw new Error("INVALID_SLOT")

  const drug = await prisma.drug.findUnique({ where: { id: input.drugId } })
  if (!drug || drug.slotId.toUpperCase() !== slotKey || drug.quantity <= 0) {
    throw new Error("DRUG_UNAVAILABLE")
  }

  const qty = Math.max(1, Math.min(input.quantity ?? 1, drug.quantity))
  const expiresAt = new Date(Date.now() + TICKET_TTL_MS)
  const code = buildTicketCode(slotKey)
  const signBase = `${code}|${input.sessionId}|${drug.id}|${qty}|${expiresAt.toISOString()}`
  const signature = signPayload(signBase)

  await prisma.pickupTicket.updateMany({
    where: {
      sessionId: input.sessionId,
      status: PickupTicketStatus.ISSUED,
    },
    data: { status: PickupTicketStatus.CANCELLED },
  })

  const ticket = await prisma.pickupTicket.create({
    data: {
      code,
      sessionId: input.sessionId,
      drugId: drug.id,
      slotId: slotKey,
      quantity: qty,
      channel,
      expiresAt,
      signature,
      riskLevel: input.riskLevel ?? "LOW",
      status: PickupTicketStatus.ISSUED,
    },
    include: { drug: true },
  })

  await prisma.chatSession.update({
    where: { id: input.sessionId },
    data: {
      pickupStatus: PickupStatus.QR_ISSUED,
      recommendedDrugId: drug.id,
    },
  })

  return {
    code: ticket.code,
    signature: ticket.signature,
    drugId: ticket.drugId,
    slotId: ticket.slotId,
    quantity: ticket.quantity,
    channel: ticket.channel,
    expiresAt: ticket.expiresAt.toISOString(),
    riskLevel: ticket.riskLevel,
    drugName: ticket.drug.name,
  }
}

export async function redeemPickupTicket(code: string, signature: string) {
  const ticket = await prisma.pickupTicket.findUnique({
    where: { code },
    include: { drug: true, session: true },
  })
  if (!ticket) throw new Error("NOT_FOUND")

  if (ticket.status === PickupTicketStatus.REDEEMED) {
    return {
      ok: true,
      alreadyRedeemed: true,
      channel: ticket.channel,
      slotId: ticket.slotId,
      drugName: ticket.drug.name,
    }
  }

  if (
    ticket.status === PickupTicketStatus.CANCELLED ||
    ticket.status === PickupTicketStatus.EXPIRED
  ) {
    throw new Error("INVALID_STATUS")
  }

  if (ticket.expiresAt.getTime() < Date.now()) {
    await prisma.pickupTicket.update({
      where: { id: ticket.id },
      data: { status: PickupTicketStatus.EXPIRED },
    })
    await prisma.chatSession.update({
      where: { id: ticket.sessionId },
      data: { pickupStatus: PickupStatus.EXPIRED },
    })
    throw new Error("EXPIRED")
  }

  const signBase = `${ticket.code}|${ticket.sessionId}|${ticket.drugId}|${ticket.quantity}|${ticket.expiresAt.toISOString()}`
  const expected = signPayload(signBase)
  if (signature !== expected && signature !== ticket.signature) {
    throw new Error("BAD_SIGNATURE")
  }

  if (ticket.drug.quantity < ticket.quantity) {
    throw new Error("OUT_OF_STOCK")
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.pickupTicket.update({
      where: { id: ticket.id },
      data: {
        status: PickupTicketStatus.REDEEMED,
        redeemedAt: new Date(),
      },
    })
    await tx.drug.update({
      where: { id: ticket.drugId },
      data: { quantity: { decrement: ticket.quantity } },
    })
    await tx.chatSession.update({
      where: { id: ticket.sessionId },
      data: { pickupStatus: PickupStatus.PICKED },
    })
  })

  return {
    ok: true,
    alreadyRedeemed: false,
    channel: ticket.channel,
    slotId: ticket.slotId,
    drugName: ticket.drug.name,
    quantity: ticket.quantity,
  }
}

export async function getTicketStatusForUser(code: string, userId: string) {
  const ticket = await prisma.pickupTicket.findUnique({
    where: { code },
    include: { drug: true, session: { select: { userId: true } } },
  })
  if (!ticket || ticket.session.userId !== userId) return null

  let status = ticket.status
  if (
    status === PickupTicketStatus.ISSUED &&
    ticket.expiresAt.getTime() < Date.now()
  ) {
    status = PickupTicketStatus.EXPIRED
  }

  return {
    code: ticket.code,
    status,
    slotId: ticket.slotId,
    drugName: ticket.drug.name,
    quantity: ticket.quantity,
    expiresAt: ticket.expiresAt.toISOString(),
    redeemedAt: ticket.redeemedAt?.toISOString() ?? null,
    riskLevel: ticket.riskLevel,
  }
}
