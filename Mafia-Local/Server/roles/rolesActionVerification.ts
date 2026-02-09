import type { PlayerRole, Player } from "../players.js"
import { countPlayerVotes } from "../gameLogic/gameLogic.js"

/* ======================================================
                        Phases
  - IMPORTANT: keep these aligned with YOUR server phases.
====================================================== */

export type GamePhase = "DISCUSSION" | "DAY" | "VOTING" | "NIGHT"

/* ======================================================
                        Roles
====================================================== */

export const ROLES: PlayerRole[] = ["MAFIA", "DOCTOR", "DETECTIVE", "SHERIFF", "CIVILIAN"]

/* ======================================================
                UI metadata (server hints)
  - Safe to expose because it contains no hidden info.
====================================================== */

export type AllyMark = "DEMON" | "CROSS"

export type RoleUiMeta = {
  showAllies: boolean
  allyMark?: AllyMark
}

export const ROLE_UI: Record<PlayerRole, RoleUiMeta> = {
  MAFIA: { showAllies: true, allyMark: "DEMON" },
  DOCTOR: { showAllies: true, allyMark: "CROSS" },
  DETECTIVE: { showAllies: false },
  SHERIFF: { showAllies: false },
  CIVILIAN: { showAllies: false },
}

/* ======================================================
                What each role can do and when
  - Updated to match your rules:
    * Sheriff can shoot anytime EXCEPT NIGHT
====================================================== */

export type RoleActionType =
  | "MAFIA_KILL_VOTE" 
  | "DOCTOR_SAVE"
  | "DETECTIVE_CHECK"
  | "SHERIFF_SHOOT"
  | "CIVILIAN_DUMMY_PICK"

export const ROLE_ALLOWED_PHASES: Record<PlayerRole, GamePhase[]> = {
  // Mafia: only kill at night
  MAFIA: ["NIGHT"],

  // Doctor: only save at night
  DOCTOR: ["NIGHT"],

  // Detective: only check at night
  DETECTIVE: ["NIGHT"],

  // Sheriff: can shoot anytime EXCEPT NIGHT
  SHERIFF: ["DISCUSSION", "DAY", "VOTING"],

  // Civilians: can pick at night but it does nothing
  CIVILIAN: ["NIGHT"],
}

export const ROLE_ACTION_TYPE: Record<PlayerRole, RoleActionType> = {
  MAFIA: "MAFIA_KILL_VOTE",
  DOCTOR: "DOCTOR_SAVE",
  DETECTIVE: "DETECTIVE_CHECK",
  SHERIFF: "SHERIFF_SHOOT",
  CIVILIAN: "CIVILIAN_DUMMY_PICK",
}

export function roleCanActInPhase(role: PlayerRole, phase: GamePhase): boolean {
  return (ROLE_ALLOWED_PHASES[role] ?? []).includes(phase)
}

/* ======================================================
                        Target rules
  - Updated to match your rules:
    * No one can target spectators
    * Mafia cannot target fellow mafia
====================================================== */

export type TargetContext = {
  actorRole: PlayerRole
  actorClientId: string
  targetRole: PlayerRole
  targetClientId: string
  targetIsSpectator: boolean
}

export function canTarget(context: TargetContext): boolean {
  // Universal: cannot target spectators
  if (context.targetIsSpectator) return false

  // Mafia cannot target fellow mafia
  if (context.actorRole === "MAFIA" && context.targetRole === "MAFIA") return false

  // Otherwise allowed
  return true
}

/* ======================================================
                        Actions
  - Server-side intent records.
  - Resolution happens at end of the phase.
====================================================== */

export type BaseAction = {
  type: RoleActionType
  roomId: string
  gameNumber: number
  phase: GamePhase
  actorClientId: string
  targetClientId: string
  createdAtMs: number
}

/* ---------------- Mafia Vote Kill ----------------
  - If no votes at all => no kill
  - If tie => random kill
  - 3+ mafia => majority wins (tie => random kill)
--------------------------------------------------- */

export type MafiaKillVoteAction = BaseAction & { type: "MAFIA_KILL_VOTE" }

/* ---------------- Doctor Save ----------------
  - Multiple doctors can save multiple targets.
  - Self-save only once per game (per doctor).
  - Saves apply ONLY to mafia kills (NOT sheriff shot).
------------------------------------------------ */

export type DoctorSaveAction = BaseAction & { type: "DOCTOR_SAVE" }

/* ---------------- Detective Check ----------------
  - Detective learns only: isMafia boolean.
  - No ally indicators for detectives.
--------------------------------------------------- */

export type DetectiveCheckAction = BaseAction & { type: "DETECTIVE_CHECK" }

/* ---------------- Sheriff Shoot ----------------
  - Can shoot anytime except NIGHT.
  - One use per game.
  - Doctor save does NOT apply to sheriff shot.
-------------------------------------------------- */

export type SheriffShootAction = BaseAction & { type: "SHERIFF_SHOOT" }

/* ---------------- Civilian Dummy Pick ----------------
  - No effect; purely for UX.
------------------------------------------------------ */

export type CivilianDummyPickAction = BaseAction & { type: "CIVILIAN_DUMMY_PICK" }

export type RoleAction =
  | MafiaKillVoteAction
  | DoctorSaveAction
  | DetectiveCheckAction
  | SheriffShootAction
  | CivilianDummyPickAction

/* ======================================================
                Resolution outputs (no sockets)
====================================================== */

export type MafiaKillResolution =
  | { outcome: "KILL"; targetClientId: string }
  | { outcome: "NO_KILL"; reason: "TIE" | "NO_VALID_TARGETS" | "NO_VOTES" }
  | { outcome: "RANDOM_KILL"; targetClientId: string }

export type DoctorSaveResolution = {
  savedClientIds: Set<string>
}

export type DetectiveResult = {
  detectiveClientId: string
  targetClientId: string
  isMafia: boolean
}

export type SheriffShootResolution = {
  sheriffClientId: string
  targetClientId: string
  targetWasMafia: boolean
  targetDied: boolean
}

/* ======================================================
                Helper: Mafia kill voting rules
====================================================== */

export function resolveMafiaKill(options: {
  mafiaClientIds: string[]
  votesByMafia: Record<string, string | undefined>
  eligibleTargetClientIds: string[]
  pickRandom: (arr: string[]) => string
}): MafiaKillResolution {
  const { mafiaClientIds, votesByMafia, eligibleTargetClientIds, pickRandom } = options

  if (eligibleTargetClientIds.length === 0) {
    return { outcome: "NO_KILL", reason: "NO_VALID_TARGETS" }
  }

  const tally = new Map<string, number>()
  for (const mafiaId of mafiaClientIds) {
    const target = votesByMafia[mafiaId]
    if (!target) continue
    tally.set(target, (tally.get(target) ?? 0) + 1)
  }

  // No votes => no kill
  if (tally.size === 0) {
    return { outcome: "NO_KILL", reason: "NO_VOTES" }
  }

  const voteBoard: Player[] = eligibleTargetClientIds.map((targetClientId, idx) => ({
    id: `VOTE_TARGET_${idx}`,
    name: `Vote Target ${idx}`,
    clientId: targetClientId,
    alive: true,
    role: "CIVILIAN",
    status: "CONNECTED",
    isSpectator: false,
    voteCount: tally.get(targetClientId) ?? 0,
    joinedAt: 0,
  }))

  const topTargets = countPlayerVotes(voteBoard)
  if (topTargets === false || topTargets.length === 0) {
    return { outcome: "NO_KILL", reason: "NO_VALID_TARGETS" }
  }

  // Tie => random kill
  if (topTargets.length !== 1) {
    return { outcome: "RANDOM_KILL", targetClientId: pickRandom(eligibleTargetClientIds) }
  }

  const target = topTargets[0]
  if (!target) return { outcome: "NO_KILL", reason: "NO_VALID_TARGETS" }

  return { outcome: "KILL", targetClientId: target.clientId }
}

/* ======================================================
                Helper: Doctor save rules
====================================================== */

export function resolveDoctorSaves(options: {
  doctorClientIds: string[]
  savesByDoctor: Record<string, string | undefined>
}): DoctorSaveResolution {
  const saved = new Set<string>()
  for (const docId of options.doctorClientIds) {
    const target = options.savesByDoctor[docId]
    if (target) saved.add(target)
  }
  return { savedClientIds: saved }
}

/* ======================================================
      Helper: Doctor self-save usage rule
  - Each doctor may self-save ONCE per game.
====================================================== */

export function canDoctorSelfSave(options: {
  doctorClientId: string
  targetClientId: string
  selfSaveUses: Record<string, number | undefined>
}): boolean {
  const { doctorClientId, targetClientId, selfSaveUses } = options
  if (doctorClientId !== targetClientId) return true
  const used = selfSaveUses[doctorClientId] ?? 0
  return used < 1
}

/* ======================================================
                Helper: Sheriff one-shot rule
====================================================== */

export function canSheriffShoot(options: {
  sheriffClientId: string
  usedAlready: Record<string, boolean | undefined>
}): boolean {
  return !(options.usedAlready[options.sheriffClientId] ?? false)
}
