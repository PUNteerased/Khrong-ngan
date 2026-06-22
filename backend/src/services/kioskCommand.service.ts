import { randomUUID } from "crypto"

export type KioskCommandStatus =
  | "pending"
  | "delivered"
  | "acked"
  | "failed"
  | "expired"

export type KioskCommandAction =
  | "dispense"
  | "dispense_all"
  | "scan_start"
  | "scan_cancel"
  | "confirm_pickup"
  | "submit_code"

export type KioskCommandRecord = {
  id: string
  action: KioskCommandAction
  slot: number
  code: string | null
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

function commandInProgress(): boolean {
  return Boolean(
    activeCommand &&
      (activeCommand.status === "pending" || activeCommand.status === "delivered")
  )
}

function queueCommand(
  action: KioskCommandAction,
  slot: number,
  code: string | null = null
): KioskCommandRecord {
  expireIfNeeded()

  if (commandInProgress()) {
    throw new Error("COMMAND_IN_PROGRESS")
  }

  activeCommand = {
    id: randomUUID(),
    action,
    slot,
    code,
    status: "pending",
    createdAt: new Date().toISOString(),
    deliveredAt: null,
    ackAt: null,
    result: null,
    error: null,
  }

  return activeCommand
}

export function queueServoTest(slot: number): KioskCommandRecord {
  if (!Number.isInteger(slot) || slot < 0 || slot > MAX_SLOT) {
    throw new Error("INVALID_SLOT")
  }
  return queueCommand("dispense", slot)
}

export function queueServoTestAll(): KioskCommandRecord {
  return queueCommand("dispense_all", -1)
}

function clearStaleDisplayCommand(maxAgeMs = 8000): void {
  if (!activeCommand) return
  if (activeCommand.status !== "pending" && activeCommand.status !== "delivered") {
    return
  }
  const anchor = activeCommand.deliveredAt || activeCommand.createdAt
  if (Date.now() - new Date(anchor).getTime() > maxAgeMs) {
    activeCommand = null
  }
}

export function queueDisplayScanStart(): KioskCommandRecord {
  expireIfNeeded()
  if (
    activeCommand &&
    activeCommand.action === "scan_start" &&
    (activeCommand.status === "pending" || activeCommand.status === "delivered")
  ) {
    return activeCommand
  }
  clearStaleDisplayCommand()
  if (commandInProgress()) {
    throw new Error("COMMAND_IN_PROGRESS")
  }
  return queueCommand("scan_start", -1)
}

export function queueDisplayScanCancel(): KioskCommandRecord {
  expireIfNeeded()
  clearStaleDisplayCommand(3000)
  if (
    activeCommand &&
    (activeCommand.status === "pending" || activeCommand.status === "delivered")
  ) {
    activeCommand = null
  }
  return queueCommand("scan_cancel", -1)
}

export function queueDisplayConfirmPickup(): KioskCommandRecord {
  return queueCommand("confirm_pickup", -1)
}

export function queueDisplaySubmitCode(code: string): KioskCommandRecord {
  const normalized = code.trim().toUpperCase()
  if (!normalized) {
    throw new Error("INVALID_CODE")
  }
  expireIfNeeded()
  clearStaleDisplayCommand()
  if (
    activeCommand &&
    (activeCommand.status === "pending" || activeCommand.status === "delivered")
  ) {
    activeCommand = null
  }
  if (commandInProgress()) {
    throw new Error("COMMAND_IN_PROGRESS")
  }
  return queueCommand("submit_code", -1, normalized)
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
    error: ok ? null : error?.trim() || "command failed",
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
