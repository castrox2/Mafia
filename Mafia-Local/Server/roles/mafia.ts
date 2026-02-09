/* ======================================================
                    roles/mafia.ts
  Mafia night kill resolution (server-side).

  IMPORTANT DESIGN RULES:
  - NO Socket.IO usage here.
  - NO phase scheduling here.
  - NO direct room mutation here.
  - Returns a decision/result only.

  Your rules implemented:
  1) Mafia can target ANYONE (any role) EXCEPT fellow mafia.
  2) Actions cannot target spectators.
  3) Mafia can ONLY kill at night (buffer routes votes to NIGHT; resolver assumes NIGHT).
  4) If there are multiple mafia:
     - tie => random kill
     - majority wins normally
  5) If NO mafia votes, no kill.
====================================================== */

import type { Player } from "../players.js"
import type { MafiaKillVoteAction, ClientId } from "./types.js"
import {
  countPlayerVotes,
  isPlayerActive,
  isPlayerAlive,
  isPlayerRole,
} from "../gameLogic/gameLogic.js"

/* ------------------------------------------------------
                  Helpers (local)
------------------------------------------------------ */

const eligibleKillTargets = (players: Player[]): Player[] => {
  // Mafia can kill anyone who is:
  // - not a spectator
  // - alive
  // - not mafia
  return players.filter(
    (p) => isPlayerActive(p) && isPlayerAlive(p) && !isPlayerRole(p, "MAFIA")
  )
}

const aliveMafia = (players: Player[]): Player[] => {
  return players.filter(
    (p) => isPlayerActive(p) && isPlayerAlive(p) && isPlayerRole(p, "MAFIA")
  )
}

const pickRandom = <T,>(arr: T[], rng: () => number): T | null => {
  if (arr.length === 0) return null
  const idx = Math.floor(rng() * arr.length)
  return arr[idx] ?? null
}

/* ------------------------------------------------------
                  Public API
------------------------------------------------------ */

export type MafiaResolution = {
  // The chosen target (clientId) or null if no kill (tie / no targets)
  targetClientId: ClientId | null

  // Helpful debug info (safe to keep server-side; don't broadcast to clients)
  debug: {
    aliveMafiaCount: number
    eligibleTargetCount: number
    votesCounted: Record<ClientId, number>
    reason:
      | "no_alive_mafia"
      | "no_eligible_targets"
      | "no_votes_no_kill"
      | "single_mafia_vote"
      | "majority_vote"
      | "tie_random_kill"
      | "no_valid_votes_no_kill"
  }
}

/**
 * Resolve mafia kill for the NIGHT phase.
 *
 * @param players  Current room players (server truth)
 * @param actions  MafiaKillVoteAction list (usually from roles/index.ts buffer)
 * @param rng      Injected RNG for testing; defaults to Math.random
 */
export const resolveMafiaNightKill = (
  players: Player[],
  actions: MafiaKillVoteAction[],
  rng: () => number = Math.random
): MafiaResolution => {
  const mafias = aliveMafia(players)
  const targets = eligibleKillTargets(players)

  // Defensive fallback:
  // Room-level winner checks should normally end the game before NIGHT resolves.
  // If we still get here with 0 mafia, return no kill safely.
  if (mafias.length === 0) {
    return {
      targetClientId: null,
      debug: {
        aliveMafiaCount: 0,
        eligibleTargetCount: targets.length,
        votesCounted: {},
        reason: "no_alive_mafia",
      },
    }
  }

  // Defensive fallback:
  // If only mafia are alive, room-level winner checks should already declare mafia win.
  // Keep this as a safe no-kill return in case resolver is called out of sequence.
  if (targets.length === 0) {
    return {
      targetClientId: null,
      debug: {
        aliveMafiaCount: mafias.length,
        eligibleTargetCount: 0,
        votesCounted: {},
        reason: "no_eligible_targets",
      },
    }
  }

  // Build quick lookup sets for validation
  const mafiaIds = new Set(mafias.map((m) => m.clientId))
  const eligibleTargetIds = new Set(targets.map((t) => t.clientId))

  // Filter to VALID mafia votes:
  // - voter must be alive mafia (not spectator)
  // - target must be eligible (not spectator, alive, not mafia)
  const validVotes = actions.filter((a) => {
    if (!mafiaIds.has(a.fromClientId)) return false
    if (!eligibleTargetIds.has(a.targetClientId)) return false
    return true
  })

  // Tally votes by targetClientId
  const tally = new Map<ClientId, number>()
  for (const v of validVotes) {
    tally.set(v.targetClientId, (tally.get(v.targetClientId) ?? 0) + 1)
  }

  const votesCounted: Record<ClientId, number> = {}
  for (const [k, n] of tally.entries()) votesCounted[k] = n

  // If nobody voted (or all votes invalid), no kill.
  if (validVotes.length === 0) {
    return {
      targetClientId: null,
      debug: {
        aliveMafiaCount: mafias.length,
        eligibleTargetCount: targets.length,
        votesCounted,
        reason: actions.length === 0 ? "no_votes_no_kill" : "no_valid_votes_no_kill",
      },
    }
  }

  // If exactly 1 mafia alive: their valid vote decides (latest already handled by buffer)
  if (mafias.length === 1) {
    // There could technically be multiple votes if caller didn't dedupe,
    // but our buffer should dedupe per player. We'll still pick the most common.
    let bestTarget: ClientId | null = null
    let bestVotes = -1
    for (const [targetId, count] of tally.entries()) {
      if (count > bestVotes) {
        bestVotes = count
        bestTarget = targetId
      }
    }

    return {
      targetClientId: bestTarget,
      debug: {
        aliveMafiaCount: 1,
        eligibleTargetCount: targets.length,
        votesCounted,
        reason: "single_mafia_vote",
      },
    }
  }

  // Multiple mafia:
  // - Majority wins
  // - Tie => random kill
  const voteBoard = targets.map((target) => ({
    ...target,
    voteCount: tally.get(target.clientId) ?? 0,
  }))
  const topTargetsByVote = countPlayerVotes(voteBoard)
  if (topTargetsByVote === false) {
    return {
      targetClientId: null,
      debug: {
        aliveMafiaCount: mafias.length,
        eligibleTargetCount: targets.length,
        votesCounted,
        reason: "no_eligible_targets",
      },
    }
  }

  // Tie among top => random kill
  if (topTargetsByVote.length !== 1) {
    const pick = pickRandom(targets, rng)
    return {
      targetClientId: pick?.clientId ?? null,
      debug: {
        aliveMafiaCount: mafias.length,
        eligibleTargetCount: targets.length,
        votesCounted,
        reason: "tie_random_kill",
      },
    }
  }

  return {
    targetClientId: topTargetsByVote[0]?.clientId ?? null,
    debug: {
      aliveMafiaCount: mafias.length,
      eligibleTargetCount: targets.length,
      votesCounted,
      reason: "majority_vote",
    },
  }
}
