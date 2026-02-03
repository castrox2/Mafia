/* ======================================================
                    roles/doctor.ts
  Doctor night save handling (server-side).

  IMPORTANT DESIGN RULES:
  - NO Socket.IO usage here.
  - NO phase scheduling here.
  - NO direct room mutation here.
  - Returns a decision/result only.

  Your rules implemented:
  1) Doctor can save ONLY at night (resolver assumes NIGHT).
  2) Doctor saves ONLY apply to mafia kills (handled by caller).
  3) Multiple doctors can save different people: all saves apply.
  4) Doctors cannot target spectators.
  5) Each doctor may self-save ONLY ONCE per game.
====================================================== */

import type { Player } from "../players.js"
import type { DoctorSaveAction, ClientId } from "./types.js"

/* ------------------------------------------------------
                  Types
------------------------------------------------------ */

/**
 * Tracks whether a doctor has already self-saved in this game.
 * Keyed by doctor clientId => boolean usedSelfSave
 */
export type DoctorSelfSaveTracker = Record<ClientId, boolean>

export type DoctorResolution = {
  // Unique set of saved targets (clientIds). Can include multiple.
  savedClientIds: ClientId[]

  // Attempts we ignored because of rules (useful for logs/debug)
  rejected: Array<{
    byClientId: ClientId
    targetClientId: ClientId
    reason:
      | "not_alive_doctor"
      | "target_not_eligible"
      | "self_save_already_used"
  }>

  debug: {
    aliveDoctorCount: number
    eligibleTargetCount: number
    validSaveCount: number
  }
}

/* ------------------------------------------------------
                  Helpers (local)
------------------------------------------------------ */

const isActive = (p: Player) => p.isSpectator !== true
const isAlive = (p: Player) => p.alive === true
const isDoctor = (p: Player) => p.role === "DOCTOR"

const aliveDoctors = (players: Player[]): Player[] => {
  return players.filter((p) => isActive(p) && isAlive(p) && isDoctor(p))
}

const eligibleSaveTargets = (players: Player[]): Player[] => {
  // Doctors can save:
  // - any ACTIVE (non-spectator) alive player
  // (including other doctors, civilians, detectives, sheriffs, etc.)
  return players.filter((p) => isActive(p) && isAlive(p))
}

/* ------------------------------------------------------
                  Public API
------------------------------------------------------ */

/**
 * Resolve doctor saves for the NIGHT phase.
 *
 * @param players            Current room players (server truth)
 * @param actions            DoctorSaveAction list (usually from roles/index.ts buffer)
 * @param selfSaveUsedByDoctor  map of doctorClientId => boolean (once per game)
 *
 * Returns:
 * - savedClientIds: list of targets that are saved tonight
 * - rejected: list of ignored actions with reason
 *
 * NOTE:
 * - This function does not apply saves to kills. Caller uses savedClientIds to
 *   decide whether mafia kill is blocked (your rule).
 */
export const resolveDoctorNightSaves = (
  players: Player[],
  actions: DoctorSaveAction[],
  selfSaveUsedByDoctor: DoctorSelfSaveTracker
): DoctorResolution => {
  const doctors = aliveDoctors(players)
  const targets = eligibleSaveTargets(players)

  const doctorIds = new Set(doctors.map((d) => d.clientId))
  const eligibleTargetIds = new Set(targets.map((t) => t.clientId))

  const saved = new Set<ClientId>()
  const rejected: DoctorResolution["rejected"] = []

  let validSaveCount = 0

  for (const a of actions) {
    const by = a.fromClientId
    const target = a.targetClientId

    // Must be an alive doctor (active)
    if (!doctorIds.has(by)) {
      rejected.push({ byClientId: by, targetClientId: target, reason: "not_alive_doctor" })
      continue
    }

    // Target must be an eligible alive non-spectator
    if (!eligibleTargetIds.has(target)) {
      rejected.push({ byClientId: by, targetClientId: target, reason: "target_not_eligible" })
      continue
    }

    // Self-save once per game
    if (by === target) {
      const used = selfSaveUsedByDoctor[by] === true
      if (used) {
        rejected.push({ byClientId: by, targetClientId: target, reason: "self_save_already_used" })
        continue
      }
      // We do NOT mark it as used here (no mutation rule).
      // Caller (rooms.ts) should mark it used AFTER accepting the action.
    }

    // Save applies
    saved.add(target)
    validSaveCount++
  }

  return {
    savedClientIds: Array.from(saved.values()),
    rejected,
    debug: {
      aliveDoctorCount: doctors.length,
      eligibleTargetCount: targets.length,
      validSaveCount,
    },
  }
}
