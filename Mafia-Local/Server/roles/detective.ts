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

    // Defensive: alive-only + must actually be detective
    if (actor.isSpectator === true || actor.alive !== true || actor.role !== "DETECTIVE") {
      rejected.push({
        byClientId: a.fromClientId,
        targetClientId: a.targetClientId,
        reason: "not_alive_detective",
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

    privateMessages.push({
      type: "DETECTIVE_RESULT",
      toClientId: actor.clientId,
      checkedClientId: target.clientId,
      isMafia: target.role === "MAFIA",
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
