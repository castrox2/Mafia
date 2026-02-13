import type {
  GameSettingsPayload,
  MafiaPhase,
  MafiaPlayer,
  MafiaPlayerRole,
  MafiaPlayerStatus,
  PhaseTimersPayload,
  RoleCountPayload,
  RoomStatePayload,
} from "../../Shared/events.js"

export type PlayerRole = MafiaPlayerRole
export type PlayerStatus = MafiaPlayerStatus
export type Player = MafiaPlayer
export type RoomState = RoomStatePayload
export type Phase = MafiaPhase
export type PhaseTimers = PhaseTimersPayload
export type RoleCounts = RoleCountPayload
export type GameSettings = GameSettingsPayload
