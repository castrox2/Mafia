/* ======================================================
                    roles/index.ts
  In-memory role action buffer (server-side).

  IMPORTANT DESIGN RULES:
  - This file contains NO game logic / resolution logic.
  - No Socket.IO usage here.
  - No phase scheduling here.
  - No room mutation here.

  PURPOSE:
  - Collect actions during a phase (ex: NIGHT actions).
  - Allow rooms.ts to fetch actions at phase end and resolve them.
  - Keep everything reconnect-safe by using clientId identity.

  NOTE:
  - This buffer is memory-only (resets if server restarts).
  - That is fine for local dev / LAN play.
====================================================== */

import type { PhaseName, RoleAction } from "./types.js"

/* ------------------------------------------------------
                Internal storage shape
  - roomId is normalized to uppercase by callers (recommended)
  - phase is used to separate actions by phase boundary
------------------------------------------------------ */

type RoomPhaseKey = `${string}:${PhaseName}`

const makeKey = (roomId: string, phase: PhaseName): RoomPhaseKey => {
  const cleanRoomId = (roomId || "").trim().toUpperCase()
  return `${cleanRoomId}:${phase}` as RoomPhaseKey
}

/* ------------------------------------------------------
                Action buffer storage
------------------------------------------------------ */

const actionsByRoomPhase = new Map<RoomPhaseKey, RoleAction[]>()

/* ------------------------------------------------------
                Public API (buffer ops)
------------------------------------------------------ */

/**
 * Record an action for a room + phase.
 * - Keeps the latest action per (fromClientId, kind) within that same phase,
 *   so players can change their mind without spamming duplicates.
 */
export const recordRoleAction = (action: RoleAction) => {
  const key = makeKey(action.roomId, phaseFromActionKind(action.kind))
  const list = actionsByRoomPhase.get(key) ?? []

  // Replace existing action from same player for same kind (in the same phase)
  const idx = list.findIndex(
    (a) => a.fromClientId === action.fromClientId && a.kind === action.kind
  )

  if (idx >= 0) {
    list[idx] = action
  } else {
    list.push(action)
  }

  actionsByRoomPhase.set(key, list)
}

/**
 * Get all actions for a room + phase.
 * Returns a COPY so callers can't mutate internal state accidentally.
 */
export const getRoleActions = (roomId: string, phase: PhaseName): RoleAction[] => {
  const key = makeKey(roomId, phase)
  const list = actionsByRoomPhase.get(key) ?? []
  return [...list]
}

/**
 * Clear actions for a room + phase (called at phase boundary).
 */
export const clearRoleActions = (roomId: string, phase: PhaseName) => {
  const key = makeKey(roomId, phase)
  actionsByRoomPhase.delete(key)
}

/**
 * Clear ALL buffered actions for a room (called when room closes).
 */
export const clearAllRoomActions = (roomId: string) => {
  const cleanRoomId = (roomId || "").trim().toUpperCase()
  for (const key of actionsByRoomPhase.keys()) {
    if (key.startsWith(`${cleanRoomId}:`)) {
      actionsByRoomPhase.delete(key)
    }
  }
}

/* ------------------------------------------------------
          Phase routing (minimal / safe)
  We route action -> phase bucket based on action kind.
  This prevents callers from accidentally buffering a NIGHT action in DAY.

  IMPORTANT:
  - Sheriff can be used any time except NIGHT (your rule),
    but we still bucket it under DAY-ish phases so it resolves publicly.
------------------------------------------------------ */

const phaseFromActionKind = (kind: RoleAction["kind"]): PhaseName => {
  if (kind === "MAFIA_KILL_VOTE") return "NIGHT"
  if (kind === "DOCTOR_SAVE") return "NIGHT"
  if (kind === "DETECTIVE_CHECK") return "NIGHT"

  // Sheriff is "day-time" (anything except NIGHT); we store it under DAY bucket
  // so resolution code can handle it when appropriate.
  if (kind === "SHERIFF_SHOOT") return "DAY"

  // Civilian "VOTING" is intentionally non-functional; keep it in VOTING.
  if (kind === "CIVILIAN_VOTE") return "VOTING"

  // Fallback (should never happen)
  return "DAY"
}

/* ------------------------------------------------------
          Sheriff one-time-use tracker (per game)
  - Keyed by (roomId, gameNumber, sheriffClientId)
  - Memory-only; resets if server restarts (OK for LAN/dev)
------------------------------------------------------ */

type SheriffUsedKey = `${string}:game${number}:sheriff:${string}`

const sheriffUsed = new Set<SheriffUsedKey>()

const makeSheriffUsedKey = (
  roomId: string,
  gameNumber: number,
  sheriffClientId: string
): SheriffUsedKey => {
  const cleanRoomId = (roomId || "").trim().toUpperCase()
  const cleanSheriffId = (sheriffClientId || "").trim()
  return `${cleanRoomId}:game${gameNumber}:sheriff:${cleanSheriffId}` as SheriffUsedKey
}

export const getSheriffUsed = (
  roomId: string,
  gameNumber: number,
  sheriffClientId: string
): boolean => {
  return sheriffUsed.has(makeSheriffUsedKey(roomId, gameNumber, sheriffClientId))
}

export const markSheriffUsed = (
  roomId: string,
  gameNumber: number,
  sheriffClientId: string
) => {
  sheriffUsed.add(makeSheriffUsedKey(roomId, gameNumber, sheriffClientId))
}

/* ------------------------------------------------------
          Doctor self-save tracker (per game)
  - Least invasive place to store this rule.
  - Keyed by (roomId, gameNumber, doctorClientId)
  - Memory-only; resets if server restarts (OK for LAN/dev)
------------------------------------------------------ */

type DoctorSelfSaveKey = `${string}:game${number}:doctor:${string}`

const doctorSelfSaveUsed = new Set<DoctorSelfSaveKey>()

const makeDoctorSelfSaveKey = (
  roomId: string,
  gameNumber: number,
  doctorClientId: string
): DoctorSelfSaveKey => {
  const cleanRoomId = (roomId || "").trim().toUpperCase()
  const cleanDoctorId = (doctorClientId || "").trim()
  return `${cleanRoomId}:game${gameNumber}:doctor:${cleanDoctorId}` as DoctorSelfSaveKey
}

/**
 * Check whether a doctor has already used their self-save this game.
 */
export const getDoctorSelfSaveUsed = (
  roomId: string,
  gameNumber: number,
  doctorClientId: string
): boolean => {
  return doctorSelfSaveUsed.has(makeDoctorSelfSaveKey(roomId, gameNumber, doctorClientId))
}

/**
 * Mark a doctor's self-save as used for this game.
 * Caller should only call this AFTER accepting a valid self-save action.
 */
export const markDoctorSelfSaveUsed = (
  roomId: string,
  gameNumber: number,
  doctorClientId: string
) => {
  doctorSelfSaveUsed.add(makeDoctorSelfSaveKey(roomId, gameNumber, doctorClientId))
}

/**
 * Optional cleanup: clear ALL role memory for a room.
 * Safe to call when a room is deleted/closed.
 */
export const clearRoomRoleMemory = (roomId: string) => {
  clearAllRoomActions(roomId)

  

  const cleanRoomId = (roomId || "").trim().toUpperCase()
  
    for (const key of sheriffUsed.keys()) {
    if (key.startsWith(`${cleanRoomId}:`)) {
      sheriffUsed.delete(key)
    }
  }

  for (const key of doctorSelfSaveUsed.keys()) {
    if (key.startsWith(`${cleanRoomId}:`)) {
      doctorSelfSaveUsed.delete(key)
    }
  }
}


/* ------------------------------------------------------
                Debug helpers (optional)
  - Useful while developing; safe to keep.
------------------------------------------------------ */

export const debugDumpRoomActions = (roomId: string) => {
  const cleanRoomId = (roomId || "").trim().toUpperCase()
  const out: Record<string, number> = {}

  for (const [key, list] of actionsByRoomPhase.entries()) {
    if (!key.startsWith(`${cleanRoomId}:`)) continue
    out[key] = list.length
  }

  return out
}
