/* ======================================================
                    roles/sheriff.ts
  Sheriff resolver (server-side, pure).

  IMPORTANT DESIGN RULES:
  - NO Socket.IO usage here.
  - NO phase scheduling here.
  - NO direct room mutation here.

  Your rules:
  - Sheriff can shoot any time EXCEPT NIGHT
  - Alive-only
  - One-time use per game (tracked outside; passed in)
  - If target is mafia -> mafia dies
  - If target is not mafia -> nothing happens (but action is still "used")
====================================================== */

import type { Player } from "../players.js"
import type { SheriffShootAction, PublicAnnouncement, ClientId } from "./types.js"

export type SheriffUsedTracker = Record<ClientId, boolean>

export type SheriffResolveResult = {
  usedByClientIds: ClientId[] // who consumed their one-time use this resolution
  killedClientId: ClientId | null // if multiple shots kill mafia, we report all (room mutation happens outside)
  publicAnnouncements: PublicAnnouncement[]
  rejected: Array<{
    byClientId: ClientId
    targetClientId: ClientId
    reason: "actor_not_found" | "not_alive_sheriff" | "target_not_eligible" | "already_used"
  }>
  debug: {
    shotsReceived: number
    shotsAccepted: number
  }
}

/**
 * Resolve sheriff shots buffered for a "day-time" bucket (anything except NIGHT).
 * If multiple sheriff shots exist, we process all; each sheriff can only consume once per game.
 */
export const resolveSheriffShots = (
  players: Player[],
  shots: SheriffShootAction[],
  used: SheriffUsedTracker
): SheriffResolveResult => {
  const rejected: SheriffResolveResult["rejected"] = []
  const publicAnnouncements: PublicAnnouncement[] = []
  const usedBy: ClientId[] = []
  let killedClientId: ClientId | null = null

  let accepted = 0

  for (const a of shots) {
    const actor = players.find((p) => p.clientId === a.fromClientId)
    const target = players.find((p) => p.clientId === a.targetClientId)

    if (!actor) {
      rejected.push({
        byClientId: a.fromClientId,
        targetClientId: a.targetClientId,
        reason: "actor_not_found",
      })
      continue
    }

    // Defensive: alive-only + must actually be sheriff
    if (actor.isSpectator === true || actor.alive !== true || actor.role !== "SHERIFF") {
      rejected.push({
        byClientId: a.fromClientId,
        targetClientId: a.targetClientId,
        reason: "not_alive_sheriff",
      })
      continue
    }

    // One-time use per game
    if (used[actor.clientId] === true) {
      rejected.push({
        byClientId: a.fromClientId,
        targetClientId: a.targetClientId,
        reason: "already_used",
      })
      continue
    }

    // Defensive: target must be eligible (alive, not spectator)
    if (!target || target.isSpectator === true || target.alive !== true) {
      rejected.push({
        byClientId: a.fromClientId,
        targetClientId: a.targetClientId,
        reason: "target_not_eligible",
      })
      continue
    }

    accepted++
    used[actor.clientId] = true
    usedBy.push(actor.clientId)

    const mafiaKilled = target.role === "MAFIA"
    if (mafiaKilled) {
      // Sheriff only kills mafia; if multiple shots kill multiple mafia, last one wins.
      // (Room mutation happens outside; we just report.)
      killedClientId = target.clientId
    }

    publicAnnouncements.push({
      type: "SHERIFF_USED",
      byClientId: actor.clientId,
      targetClientId: target.clientId,
      mafiaKilled,
    })
  }

  return {
    usedByClientIds: usedBy,
    killedClientId,
    publicAnnouncements,
    rejected,
    debug: {
      shotsReceived: shots.length,
      shotsAccepted: accepted,
    },
  }
}
