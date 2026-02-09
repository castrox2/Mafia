/* ======================================================
                    roles/types.ts
  Shared types for server-side role actions + results.

  IMPORTANT DESIGN RULES:
  - This file contains NO game logic.
  - No Socket.IO usage here.
  - No phase scheduling here.
  - No room state mutation here.
  - Only type definitions and simple data shapes.

  WHY:
  - Keeps role logic clean and merge-safe.
  - Prevents "spaghetti" across rooms.ts / gameLogic.ts.
====================================================== */

export type PhaseName =
  | "LOBBY"
  | "DAY"
  | "DISCUSSION"
  | "PUBDISCUSSION"
  | "VOTING"
  | "NIGHT"
  | "GAMEOVER"

/* ------------------------------------------------------
                Identity / Targeting
  - clientId is stable identity (reconnect-safe)
  - spectators are not valid targets for actions
------------------------------------------------------ */

export type ClientId = string

// Special target id used for explicit "skip/abstain" role actions.
export const SKIP_TARGET_CLIENT_ID = "__SKIP__" as const

export type ActionTarget = {
  targetClientId: ClientId
}

/* ------------------------------------------------------
                    Action kinds
------------------------------------------------------ */

export type RoleActionKind =
  | "MAFIA_KILL_VOTE"
  | "DOCTOR_SAVE"
  | "DETECTIVE_CHECK"
  | "SHERIFF_SHOOT"
  | "CIVILIAN_VOTE" // does nothing, but allowed for UI parity

/* ------------------------------------------------------
              Base action payload shape
  - roomId is passed through socket events
  - fromClientId should come from socket.data.clientId server-side
    (we still keep it in the type because it helps in logs/testing)
------------------------------------------------------ */

export type BaseRoleAction = {
  kind: RoleActionKind
  roomId: string
  fromClientId: ClientId
  createdAtMs: number
}

/* ------------------------------------------------------
                  Specific actions
  NOTE:
  - Mafia: during NIGHT only
  - Doctor: during NIGHT only
  - Detective: during NIGHT only
  - Sheriff: any time except NIGHT (your rule)
  - Civilian: can "VOTING" but it doesn't do anything
------------------------------------------------------ */

export type MafiaKillVoteAction = BaseRoleAction &
  ActionTarget & {
    kind: "MAFIA_KILL_VOTE"
  }

export type DoctorSaveAction = BaseRoleAction &
  ActionTarget & {
    kind: "DOCTOR_SAVE"
    // Each doctor can self-save only once per game (enforced in logic layer)
  }

export type DetectiveCheckAction = BaseRoleAction &
  ActionTarget & {
    kind: "DETECTIVE_CHECK"
    // Result should be private: only "isMafia: boolean"
  }

export type SheriffShootAction = BaseRoleAction &
  ActionTarget & {
    kind: "SHERIFF_SHOOT"
    // One-time use per game (enforced in logic layer)
  }

export type CivilianVoteAction = BaseRoleAction &
  ActionTarget & {
    kind: "CIVILIAN_VOTE"
    // Intentionally does not affect game state
  }

export type RoleAction =
  | MafiaKillVoteAction
  | DoctorSaveAction
  | DetectiveCheckAction
  | SheriffShootAction
  | CivilianVoteAction

/* ------------------------------------------------------
                Resolution outputs (types)
  We separate "public announcements" from "private messages"
  so spectators / non-roles don't get spoilers.

  - PublicAnnouncement: safe for everyone
  - PrivateMessage: targeted per-client (server emits only to that client)
------------------------------------------------------ */

export type PublicAnnouncement =
  | {
      type: "SHERIFF_USED"
      byClientId: ClientId
      targetClientId: ClientId
      // if the target was mafia they die, otherwise nothing happens (your rule)
      mafiaKilled: boolean
    }
  | {
      type: "NIGHT_SUMMARY"
      // Keep this intentionally vague (anti-spoiler):
      // Example: "Someone died" / "No one died"
      someoneDied: boolean
      killedClientId?: ClientId
    }

export type PrivateMessage =
  | {
      type: "DETECTIVE_RESULT"
      toClientId: ClientId
      checkedClientId: ClientId
      isMafia: boolean
    }

/* ------------------------------------------------------
            Resolution result envelopes
  These are returned by resolver functions (later)
  and then rooms.ts decides what to emit.
------------------------------------------------------ */

export type NightResolution = {
  // Mafia target chosen by mafia vote resolution (may be null)
  mafiaTargetClientId: ClientId | null

  // Set of saves applied by doctors (can include multiple targets)
  doctorSavedClientIds: ClientId[]

  // Final kill result after doctor saves apply (doctor only blocks mafia kills)
  killedClientId: ClientId | null

  // Messages / announcements
  publicAnnouncements: PublicAnnouncement[]
  privateMessages: PrivateMessage[]
}

export type SheriffResolution = {
  used: boolean
  byClientId: ClientId
  targetClientId: ClientId
  mafiaKilled: boolean
  publicAnnouncements: PublicAnnouncement[]
}

export type ResolutionResult = {
  // Optional: lets the caller update phase, check GAMEOVER, etc.
  // We keep it flexible and non-invasive.
  night?: NightResolution
  sheriff?: SheriffResolution
}
