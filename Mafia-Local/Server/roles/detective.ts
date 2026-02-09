/* ======================================================
                  roles/detective.ts
  Detective resolver (server-side, pure).

  IMPORTANT DESIGN RULES:
  - NO Socket.IO usage here.
  - NO phase scheduling here.
  - NO direct room mutation here.

  Your rules:
  - Detective can check ONLY at NIGHT
  - Alive-only (enforced by caller, but we also validate defensively)
  - Result is PRIVATE: only the detective learns isMafia boolean
====================================================== */

import type { Player } from "../players.js"
import type { DetectiveCheckAction, PrivateMessage, ClientId } from "./types.js"
import { SKIP_TARGET_CLIENT_ID } from "./types.js"
import {
  getPlayerFromListByClientId,
  isPlayerActive,
  isPlayerAlive,
  isPlayerRole,
} from "../gameLogic/gameLogic.js"

export type DetectiveResolveResult = {
  privateMessages: PrivateMessage[]
  rejected: Array<{
    byClientId: ClientId
    targetClientId: ClientId
    reason: "actor_not_found" | "not_alive_detective" | "target_not_eligible"
  }>
  debug: {
    checksReceived: number
    checksAccepted: number
  }
}

export const resolveDetectiveChecks = (
  players: Player[],
  checks: DetectiveCheckAction[]
): DetectiveResolveResult => {
  const rejected: DetectiveResolveResult["rejected"] = []
  const privateMessages: PrivateMessage[] = []

  let accepted = 0

  for (const a of checks) {
    const actor = getPlayerFromListByClientId(players, a.fromClientId)
    const target = getPlayerFromListByClientId(players, a.targetClientId)

    if (!actor) {
      rejected.push({
        byClientId: a.fromClientId,
        targetClientId: a.targetClientId,
        reason: "actor_not_found",
      })
      continue
    }

    // Defensive: alive-only + must actually be detective
    if (
      !isPlayerActive(actor) ||
      !isPlayerAlive(actor) ||
      !isPlayerRole(actor, "DETECTIVE")
    ) {
      rejected.push({
        byClientId: a.fromClientId,
        targetClientId: a.targetClientId,
        reason: "not_alive_detective",
      })
      continue
    }

    // Explicit skip action: valid no-op.
    if (a.targetClientId === SKIP_TARGET_CLIENT_ID) {
      continue
    }

    // Defensive: target must be eligible (alive, not spectator)
    if (!target || !isPlayerActive(target) || !isPlayerAlive(target)) {
      rejected.push({
        byClientId: a.fromClientId,
        targetClientId: a.targetClientId,
        reason: "target_not_eligible",
      })
      continue
    }

    accepted++

    privateMessages.push({
      type: "DETECTIVE_RESULT",
      toClientId: actor.clientId,
      checkedClientId: target.clientId,
      isMafia: isPlayerRole(target, "MAFIA"),
    })
  }

  return {
    privateMessages,
    rejected,
    debug: {
      checksReceived: checks.length,
      checksAccepted: accepted,
    },
  }
}
