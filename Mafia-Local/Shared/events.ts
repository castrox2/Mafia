export type MafiaPhase =
  | "LOBBY"
  | "DAY"
  | "DISCUSSION"
  | "PUBDISCUSSION"
  | "VOTING"
  | "NIGHT"
  | "GAMEOVER"

export type MafiaRoomType = "CLASSIC" | "ROLE_SELECTOR"

export type RoleSelectorScriptMode =
  | "REGULAR_MAFIA"
  | "BLOOD_ON_THE_CLOCKTOWER"

export type BotcScriptSource = "PASTE" | "UPLOAD"

export type BotcRoleGroupKey =
  | "TOWNSFOLK"
  | "OUTSIDER"
  | "MINION"
  | "DEMON"
  | "OTHER"

export const ROOM_CODE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890" as const
export const ROOM_CODE_LENGTH = 5 as const
export const ROOM_CODE_REGEX = /^[A-Z0-9]{5}$/

export const TIMER_MIN_SECONDS = 10 as const
export const TIMER_MAX_SECONDS = 3600 as const

export const SKIP_TARGET_CLIENT_ID = "__SKIP__" as const

export const normalizeRoomId = (roomId: string): string =>
  String(roomId || "").trim().toUpperCase()

export const isValidRoomId = (roomId: string): boolean =>
  ROOM_CODE_REGEX.test(normalizeRoomId(roomId))

export type MafiaPlayerRole =
  | "MAFIA"
  | "CIVILIAN"
  | "DOCTOR"
  | "DETECTIVE"
  | "SHERIFF"

export type AssignedPlayerRole = MafiaPlayerRole | (string & {})

export const REGULAR_MAFIA_AVAILABLE_ROLES: MafiaPlayerRole[] = [
  "MAFIA",
  "CIVILIAN",
  "DOCTOR",
  "DETECTIVE",
  "SHERIFF",
]

export type MafiaPlayerStatus =
  | "DISCONNECTED"
  | "CONNECTED"
  | "NOT READY"
  | "READY"

export type MafiaWinner = "MAFIA" | "CIVILIANS"

export type RoleActionKind =
  | "MAFIA_KILL_VOTE"
  | "DOCTOR_SAVE"
  | "DETECTIVE_CHECK"
  | "SHERIFF_SHOOT"
  | "CIVILIAN_VOTE"

export type PhaseTimersPayload = {
  daySec: number
  nightSec: number
  voteSec: number
  discussionSec: number
  pubDiscussionSec: number
}

export type RoleCountPayload = {
  mafia: number
  doctor: number
  detective: number
  sheriff: number
}

export type GameSettingsPayload = {
  timers: PhaseTimersPayload
  roleCount: RoleCountPayload
  manualRoleAssignEnabled: boolean
}

export type RoleSelectorSettingsPayload = {
  scriptMode: RoleSelectorScriptMode
  allowRedeal: boolean
}

export type BotcScriptSummaryPayload = {
  id: string
  name: string
  source: BotcScriptSource
  roleCount: number
  roleIds: string[]
  groupedRoleIds: {
    townsfolk: string[]
    outsiders: string[]
    minions: string[]
    demons: string[]
    others: string[]
  }
  importedAtMs: number
}

export type RoleAssignmentCountsPayload = {
  mafia: number
  doctor: number
  detective: number
  sheriff: number
  civilian: number
}

export type BotcRoleDistributionPayload = {
  townsfolk: number
  outsiders: number
  minions: number
  demons: number
  others: number
}

export type RoleBoundRangePayload = {
  min: number
  max: number
}

export type RoleBoundsPayload = {
  mafia: RoleBoundRangePayload
  doctor: RoleBoundRangePayload
  detective: RoleBoundRangePayload
  sheriff: RoleBoundRangePayload
}

export type MafiaPlayer = {
  id: string
  name: string
  clientId: string
  isBot: boolean
  alive: boolean
  role: AssignedPlayerRole
  status: MafiaPlayerStatus
  isSpectator: boolean
  voteCount: number
  joinedAt: number
}

export type RoomStatePayload = {
  roomId: string
  roomType: MafiaRoomType
  hostId: string
  hostParticipates: boolean
  players: MafiaPlayer[]
  settings: GameSettingsPayload
  roleSelectorSettings: RoleSelectorSettingsPayload | null
  botcScriptSummary: BotcScriptSummaryPayload | null
  roleBounds: RoleBoundsPayload
  gameStarted: boolean
  roomLocked: boolean
  gameNumber: number
  phase: MafiaPhase
  phaseEndTime: number | null
}

export type TimerStatePayload = {
  roomId: string
  phase: MafiaPhase
  duration: number
  startedAtMs: number
  endsAtMs: number
  secondsLeft: number
  running: boolean
}

export type SetHostParticipationPayload = {
  roomId: string
  participates: boolean
}

export type HostParticipationRefusedPayload = {
  reason: string
}

export type RoomIdPayload = {
  roomId: string
}

export type ReasonPayload = {
  reason: string
}

export type RoomCreatedPayload = {
  roomId: string
  joinUrl: string
  qrDataUrl: string
}

export type ReconnectedPayload = {
  roomId: string
  playerName: string
}

export type GameStartedPayload = {
  roomId: string
  roomType: MafiaRoomType
  gameNumber: number
}

export type RoleSelectorHostCountsPayload = {
  roomId: string
  gameNumber: number
  started: boolean
  roomLocked: boolean
  scriptMode: RoleSelectorScriptMode
  counts: RoleAssignmentCountsPayload
  botcCounts: BotcRoleDistributionPayload | null
}

export type GameOverPayload = {
  roomId: string
  gameNumber: number
  winner: MafiaWinner
}

export type PhaseStartedPayload = {
  roomId: string
  gameNumber: number
  phase: MafiaPhase
  phaseEndTime: number | null
}

export type PhaseEndingPayload = {
  roomId: string
  gameNumber: number
  fromPhase: MafiaPhase
  toPhase: MafiaPhase
  leadMs: number
}

export type RoundSummaryPayload = {
  roomId: string
  gameNumber: number
  someoneDied: boolean
  killedClientId?: string
  killedPlayerName?: string
}

export type DetectiveResultPrivateMessagePayload = {
  type: "DETECTIVE_RESULT"
  toClientId: string
  checkedClientId: string
  isMafia: boolean
}

export type PrivateMessagePayload = DetectiveResultPrivateMessagePayload & {
  roomId: string
  gameNumber: number
}

export type PublicAnnouncementPayload =
  | {
      type: "SHERIFF_USED"
      byClientId: string
      targetClientId: string
      mafiaKilled: boolean
    }
  | {
      type: "NIGHT_SUMMARY"
      someoneDied: boolean
      killedClientId?: string
      killedPlayerName?: string
    }

export type PublicAnnouncementsPayload = {
  roomId: string
  gameNumber: number
  announcements: PublicAnnouncementPayload[]
}

export type YourRolePayload = {
  roomId: string
  gameNumber: number
  role: AssignedPlayerRole
  rolemateClientIds: string[]
}

export type ActionAcceptedPayload = {
  kind: string
  targetClientId: string
}

export type ActionRefusedPayload = {
  kind?: string
  reason: string
}

export type UpdateSettingsPayload = {
  roomId: string
  settings: Partial<GameSettingsPayload>
}

export type UpdateRoleSelectorSettingsPayload = {
  roomId: string
  settings: Partial<RoleSelectorSettingsPayload>
}

export type ImportBotcScriptPayload = {
  roomId: string
  source: BotcScriptSource
  rawJson: string
}

export type SetPlayerStatusPayload = {
  roomId: string
  playerId: string
  status: MafiaPlayerStatus
}

export type SetAlivePayload = {
  roomId: string
  playerId: string
  alive: boolean
}

export type SetRolePayload = {
  roomId: string
  playerId: string
  role: MafiaPlayerRole
}

export type SubmitRoleActionPayload = {
  roomId: string
  kind: string
  targetClientId: string
}

export type KickPlayerPayload = {
  roomId: string
  targetClientId: string
}

export type AddBotPayload = {
  roomId: string
}

export type AddBotRefusedPayload = {
  reason: string
}

export type CreateRoomPayload = {
  playerName: string
  baseUrl?: string
  roomType?: MafiaRoomType
}

export type JoinRoomPayload = {
  roomId: string
  playerName: string
  expectedRoomType?: MafiaRoomType
}

export interface MafiaClientToServerEvents {
  createRoom: (payload: CreateRoomPayload) => void
  joinRoom: (payload: JoinRoomPayload) => void
  leaveRoom: (roomId: string) => void
  setAlive: (payload: SetAlivePayload) => void
  setRole: (payload: SetRolePayload) => void
  updateSettings: (payload: UpdateSettingsPayload) => void
  updateRoleSelectorSettings: (payload: UpdateRoleSelectorSettingsPayload) => void
  importBotcScript: (payload: ImportBotcScriptPayload) => void
  setPlayerStatus: (payload: SetPlayerStatusPayload) => void
  setHostParticipation: (payload: SetHostParticipationPayload) => void
  requestRoomState: (payload: RoomIdPayload) => void
  startGame: (payload: RoomIdPayload) => void
  forceStartGame: (payload: RoomIdPayload) => void
  submitRoleAction: (payload: SubmitRoleActionPayload) => void
  requestMyRole: (payload: RoomIdPayload) => void
  kickPlayer: (payload: KickPlayerPayload) => void
  redealRoleSelector: (payload: RoomIdPayload) => void
  addBot: (payload: AddBotPayload) => void
  skipPhase: (payload: RoomIdPayload) => void
}

export interface MafiaServerToClientEvents {
  roomCreated: (payload: RoomCreatedPayload) => void
  roomState: (payload: RoomStatePayload) => void
  roomClosed: (payload: RoomIdPayload) => void
  roomNotFound: (payload: RoomIdPayload) => void
  roomInvalid: (payload: ReasonPayload) => void
  settingsRefused: (payload: ReasonPayload) => void
  startRefused: (payload: ReasonPayload) => void
  kickRefused: (payload: ReasonPayload) => void
  addBotRefused: (payload: AddBotRefusedPayload) => void
  kicked: (payload: ReasonPayload & RoomIdPayload) => void
  hostParticipationRefused: (payload: HostParticipationRefusedPayload) => void
  gameStarted: (payload: GameStartedPayload) => void
  gameOver: (payload: GameOverPayload) => void
  phaseStarted: (payload: PhaseStartedPayload) => void
  phaseEnding: (payload: PhaseEndingPayload) => void
  nightSummary: (payload: RoundSummaryPayload) => void
  voteSummary: (payload: RoundSummaryPayload) => void
  publicAnnouncements: (payload: PublicAnnouncementsPayload) => void
  reconnected: (payload: ReconnectedPayload) => void
  yourRole: (payload: YourRolePayload) => void
  privateMessage: (payload: PrivateMessagePayload) => void
  actionAccepted: (payload: ActionAcceptedPayload) => void
  actionRefused: (payload: ActionRefusedPayload) => void
  roleSelectorHostCounts: (payload: RoleSelectorHostCountsPayload) => void
  botcScriptImported: (payload: RoomIdPayload & { summary: BotcScriptSummaryPayload }) => void
  timerStarted: (payload: TimerStatePayload) => void
  timerState: (payload: TimerStatePayload) => void
  timerTick: (payload: TimerStatePayload) => void
  timerEnded: (payload: RoomIdPayload & { phase: MafiaPhase }) => void
  timerCleared: (payload: RoomIdPayload) => void
}

export type MafiaSocketData = {
  clientId: string
}

export type SetHostParticipationEvent =
  MafiaClientToServerEvents["setHostParticipation"]

export type HostParticipationRefusedEvent =
  MafiaServerToClientEvents["hostParticipationRefused"]

export type HostParticipationClientToServerEvents = Pick<
  MafiaClientToServerEvents,
  "setHostParticipation"
>

export type HostParticipationServerToClientEvents = Pick<
  MafiaServerToClientEvents,
  "hostParticipationRefused"
>
