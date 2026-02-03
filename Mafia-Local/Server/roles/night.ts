/* ======================================================
                    roles/night.ts
  NIGHT phase resolver (server-side).

  IMPORTANT DESIGN RULES:
  - NO Socket.IO usage here.
  - NO phase scheduling here.
  - NO direct room mutation here.
  - Combines mafia + doctor (and later detective) into one result.

  Your rules implemented:
  1) Mafia chooses kill target via votes.
     - tie => no kill
     - no votes => random eligible target
  2) Doctors choose saves at night.
     - multiple saves allowed (all targets saved)
     - doctor self-save allowed ONCE per game (enforced here via tracker)
  3) Doctor saves ONLY apply to mafia kills.
     - If mafia target is in saved set => kill blocked.
     - Sheriff shots are not handled here.
  4) Spectators cannot be targeted (handled inside resolvers).
====================================================== */

import type { Player } from "../players.js"
import type { ClientId, MafiaKillVoteAction, DoctorSaveAction } from "./types.js"

import { resolveMafiaNightKill } from "./mafia.js"
import { resolveDoctorNightSaves, type DoctorSelfSaveTracker } from "./doctor.js"
import { getDoctorSelfSaveUsed, markDoctorSelfSaveUsed } from "./index.js"

/* ------------------------------------------------------
                  Result types
------------------------------------------------------ */

export type NightVote = {
  fromClientId: string
  targetClientId: string
}

export type NightSave = {
  fromClientId: string
  targetClientId: string
}

export type NightResolveResult = {
  mafiaTargetClientId: ClientId | null
  doctorSavedClientIds: ClientId[]
  killedClientId: ClientId | null

  // Doctor self-save usage actually consumed this night (for logs/debug)
  doctorSelfSavesConsumed: ClientId[]

  // Any doctor actions rejected due to self-save limit, etc.
  rejectedDoctorActions: Array<{
    byClientId: ClientId
    targetClientId: ClientId
    reason: "not_alive_doctor" | "target_not_eligible" | "self_save_already_used"
  }>

  debug: {
    mafia: ReturnType<typeof resolveMafiaNightKill>["debug"]
    doctor: ReturnType<typeof resolveDoctorNightSaves>["debug"]
    killWasBlockedByDoctor: boolean
  }
}

/* ------------------------------------------------------
                  Public API
------------------------------------------------------ */

/**
 * Resolve the NIGHT phase actions.
 *
 * @param roomId      Room id (for doctor self-save tracking)
 * @param gameNumber  Current game number (self-save resets each new game)
 * @param players     Current room players (server truth)
 * @param mafiaVotes  MafiaKillVoteAction[] buffered for NIGHT
 * @param doctorSaves DoctorSaveAction[] buffered for NIGHT
 */
export const resolveNightPhase = (
  roomId: string,
  gameNumber: number,
  players: Player[],
  mafiaVotes: MafiaKillVoteAction[],
  doctorSaves: DoctorSaveAction[]
): NightResolveResult => {
  // 1) Mafia decides their target (or null)
  const mafiaRes = resolveMafiaNightKill(players, mafiaVotes)

  // 2) Build a tracker map for doctor self-save usage (per doctor)
  //    This is passed into resolveDoctorNightSaves so it can reject second self-save attempts.
  const selfSaveUsedByDoctor: DoctorSelfSaveTracker = {}
  for (const p of players) {
    if (p.role !== "DOCTOR") continue
    const used = getDoctorSelfSaveUsed(roomId, gameNumber, p.clientId)
    selfSaveUsedByDoctor[p.clientId] = used
  }

  // 3) Resolve doctor saves (returns saved targets + rejected list)
  const doctorRes = resolveDoctorNightSaves(players, doctorSaves, selfSaveUsedByDoctor)

  // 4) Consume doctor self-save usage for VALID self-saves that were accepted
  //    (Only if doctor saved themselves and it wasn't rejected)
  const consumed: ClientId[] = []
  for (const a of doctorSaves) {
    if (a.fromClientId !== a.targetClientId) continue // only self-saves
    const wasRejected = doctorRes.rejected.some(
      (r) =>
        r.byClientId === a.fromClientId &&
        r.targetClientId === a.targetClientId &&
        r.reason === "self_save_already_used"
    )
    if (wasRejected) continue

    // If this doctor self-saved, mark it used (once per game)
    // Safe to mark even if repeated saves occurred; Set prevents dupes.
    if (!getDoctorSelfSaveUsed(roomId, gameNumber, a.fromClientId)) {
      markDoctorSelfSaveUsed(roomId, gameNumber, a.fromClientId)
      consumed.push(a.fromClientId)
    }
  }

  // 5) Apply your rule: doctor saves ONLY block mafia kills
  const mafiaTarget = mafiaRes.targetClientId
  const savedSet = new Set<ClientId>(doctorRes.savedClientIds)

  const killBlocked = mafiaTarget != null && savedSet.has(mafiaTarget)

  const killedClientId: ClientId | null =
    mafiaTarget == null ? null : killBlocked ? null : mafiaTarget

  return {
    mafiaTargetClientId: mafiaTarget,
    doctorSavedClientIds: doctorRes.savedClientIds,
    killedClientId,

    doctorSelfSavesConsumed: consumed,
    rejectedDoctorActions: doctorRes.rejected,

    debug: {
      mafia: mafiaRes.debug,
      doctor: doctorRes.debug,
      killWasBlockedByDoctor: killBlocked,
    },
  }
}
