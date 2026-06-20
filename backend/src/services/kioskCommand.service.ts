import { randomUUID } from "crypto"

export type KioskCommandStatus =
  | "pending"
  | "delivered"
  | "acked"
  | "failed"
  | "expired"

export type KioskCommandRecord = {
  id: string
  action: "dispense" | "dispense_all"
  slot: number
  status: KioskCommandStatus
  createdAt: string
  deliveredAt: string | null
  ackAt: string | null
  result: boolean | null
  error: string | null
}

const COMMAND_TTL_MS = 2 * 60 * 1000
const MAX_SLOT = 9

let activeCommand: KioskCommandRecord | null = null

function expireIfNeeded(): void {
  if (!activeCommand) return
  const created = new Date(activeCommand.createdAt).getTime()
  if (Date.now() - created > COMMAND_TTL_MS) {
    if (activeCommand.status === "pending" || activeCommand.status === "delivered") {
      activeCommand = { ...activeCommand, status: "expired" }
    }
  }
}

export function queueServoTest(slot: number): KioskCommandRecord {
  expireIfNeeded()

  if (!Number.isInteger(slot) || slot < 0 || slot > MAX_SLOT) {
    throw new Error("INVALID_SLOT")
  }

  if (
    activeCommand &&
    (activeCommand.status === "pending" || activeCommand.status === "delivered")
  ) {
    throw new Error("COMMAND_IN_PROGRESS")
  }

  activeCommand = {
    id: randomUUID(),
    action: "dispense",
    slot,
    status: "pending",
    createdAt: new Date().toISOString(),
    deliveredAt: null,
    ackAt: null,
    result: null,
    error: null,
  }

  return activeCommand
}

export function queueServoTestAll(): KioskCommandRecord {
  expireIfNeeded()

  if (
    activeCommand &&
    (activeCommand.status === "pending" || activeCommand.status === "delivered")
  ) {
    throw new Error("COMMAND_IN_PROGRESS")
  }

  activeCommand = {
    id: randomUUID(),
    action: "dispense_all",
    slot: -1,
    status: "pending",
    createdAt: new Date().toISOString(),
    deliveredAt: null,
    ackAt: null,
    result: null,
    error: null,
  }

  return activeCommand
}

export function takePendingCommand(): KioskCommandRecord | null {
  expireIfNeeded()
  if (!activeCommand || activeCommand.status !== "pending") return null

  activeCommand = {
    ...activeCommand,
    status: "delivered",
    deliveredAt: new Date().toISOString(),
  }
  return activeCommand
}

export function ackCommand(
  id: string,
  ok: boolean,
  error?: string
): KioskCommandRecord | null {
  expireIfNeeded()
  if (!activeCommand || activeCommand.id !== id) return null
  if (activeCommand.status !== "delivered") return activeCommand

  activeCommand = {
    ...activeCommand,
    status: ok ? "acked" : "failed",
    ackAt: new Date().toISOString(),
    result: ok,
    error: ok ? null : error?.trim() || "dispense failed",
  }
  return activeCommand
}

export function getCommandStatus(): KioskCommandRecord | null {
  expireIfNeeded()
  return activeCommand
}

export function clearFinishedCommand(): void {
  expireIfNeeded()
  if (
    activeCommand &&
    (activeCommand.status === "acked" ||
      activeCommand.status === "failed" ||
      activeCommand.status === "expired")
  ) {
    activeCommand = null
  }
}
