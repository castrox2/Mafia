import type {
  AssignedPlayerRole,
  MafiaPhase,
  MafiaPlayer,
  MafiaPlayerRole,
  MafiaPlayerStatus,
  RoundSummaryPayload,
  MafiaWinner,
  RoleActionKind,
} from "../../Shared/events.js"

export type UiTone = "neutral" | "info" | "success" | "warning" | "danger"

export type UiBadge = {
  key: string
  label: string
  tone: UiTone
}

export const PHASE_UI_META: Record<
  MafiaPhase,
  { label: string; shortLabel: string; tone: UiTone }
> = {
  LOBBY: { label: "Lobby", shortLabel: "Lobby", tone: "info" },
  DAY: { label: "Day", shortLabel: "Day", tone: "neutral" },
  DISCUSSION: { label: "Private Discussion", shortLabel: "Private", tone: "neutral" },
  PUBDISCUSSION: {
    label: "Public Discussion",
    shortLabel: "Public",
    tone: "neutral",
  },
  VOTING: { label: "Voting", shortLabel: "Vote", tone: "warning" },
  NIGHT: { label: "Night", shortLabel: "Night", tone: "info" },
  GAMEOVER: { label: "Game Over", shortLabel: "Over", tone: "danger" },
}

export const ROLE_UI_META: Record<
  MafiaPlayerRole,
  { label: string; teamLabel: "Mafia" | "Civilians"; tone: UiTone }
> = {
  MAFIA: { label: "Mafia", teamLabel: "Mafia", tone: "danger" },
  CIVILIAN: { label: "Civilian", teamLabel: "Civilians", tone: "neutral" },
  DOCTOR: { label: "Doctor", teamLabel: "Civilians", tone: "success" },
  DETECTIVE: { label: "Detective", teamLabel: "Civilians", tone: "info" },
  SHERIFF: { label: "Sheriff", teamLabel: "Civilians", tone: "warning" },
}

export const PLAYER_STATUS_UI_META: Record<
  MafiaPlayerStatus,
  { label: string; tone: UiTone }
> = {
  DISCONNECTED: { label: "Disconnected", tone: "danger" },
  CONNECTED: { label: "Connected", tone: "info" },
  "NOT READY": { label: "Not Ready", tone: "warning" },
  READY: { label: "Ready", tone: "success" },
}

const NIGHT_ROLE_ACTION_META: Partial<
  Record<MafiaPlayerRole, { kind: RoleActionKind; actionLabel: string; skipLabel: string }>
> = {
  MAFIA: { kind: "MAFIA_KILL_VOTE", actionLabel: "Kill", skipLabel: "Skip Kill" },
  DOCTOR: { kind: "DOCTOR_SAVE", actionLabel: "Save", skipLabel: "Skip Save" },
  DETECTIVE: { kind: "DETECTIVE_CHECK", actionLabel: "Investigate", skipLabel: "Skip Check" },
}

const ROLE_ACTION_UI_META: Record<
  RoleActionKind,
  { label: string; recordedLabel: string }
> = {
  MAFIA_KILL_VOTE: { label: "Mafia Kill Vote", recordedLabel: "Mafia kill vote" },
  DOCTOR_SAVE: { label: "Doctor Save", recordedLabel: "Doctor save" },
  DETECTIVE_CHECK: { label: "Detective Check", recordedLabel: "Detective check" },
  SHERIFF_SHOOT: { label: "Sheriff Shot", recordedLabel: "Sheriff shot" },
  CIVILIAN_VOTE: { label: "Civilian Vote", recordedLabel: "Vote" },
}

export const getPhaseLabel = (phase: MafiaPhase): string => PHASE_UI_META[phase].label

const isKnownRole = (role: string): role is MafiaPlayerRole =>
  Object.prototype.hasOwnProperty.call(ROLE_UI_META, role)

export const getRoleLabel = (role: AssignedPlayerRole): string => {
  const nextRole = String(role || "").trim()
  if (!nextRole) return "Unknown"
  return isKnownRole(nextRole) ? ROLE_UI_META[nextRole].label : nextRole
}

export const getStatusLabel = (status: MafiaPlayerStatus): string =>
  PLAYER_STATUS_UI_META[status].label

export const getWinnerLabel = (winner: MafiaWinner | null): string => {
  if (!winner) return "(pending)"
  return winner === "MAFIA" ? "Mafia" : "Civilians"
}

export const getNightSummaryLabel = (payload: RoundSummaryPayload): string => {
  if (!payload.someoneDied) return "Night ended: no one died."

  const killedName = String(payload.killedPlayerName || "").trim()
  if (killedName) return `Night ended: ${killedName} was killed.`

  return "Night ended: someone was killed."
}

export const getActionLabel = (kind: string): string => {
  const typedKind = kind as RoleActionKind
  const known = ROLE_ACTION_UI_META[typedKind]
  if (known) return known.label
  return kind.replaceAll("_", " ").trim()
}

export const getActionRecordedLabel = (kind: string): string => {
  const typedKind = kind as RoleActionKind
  const known = ROLE_ACTION_UI_META[typedKind]
  if (known) return known.recordedLabel
  return getActionLabel(kind)
}

export const getNightActionMetaForRole = (role: string | null) => {
  if (!role) return null
  return NIGHT_ROLE_ACTION_META[role as MafiaPlayerRole] ?? null
}

export const getPlayerLifeStateLabel = (player: MafiaPlayer): string => {
  if (player.isSpectator) return "Spectator"
  return player.alive ? "Alive" : "Dead"
}

export const getPlayerTags = (
  player: MafiaPlayer,
  ctx: {
    hostId: string
    viewerClientId?: string
  }
): UiBadge[] => {
  const tags: UiBadge[] = []
  const isHost = player.clientId === ctx.hostId

  if (player.isBot) {
    tags.push({ key: "BOT", label: "BOT", tone: "info" })
  }

  if (isHost && player.isSpectator) {
    tags.push({ key: "HOST_DEVICE", label: "HOST DEVICE", tone: "info" })
  } else if (isHost) {
    tags.push({ key: "HOST", label: "HOST", tone: "info" })
  }
  if (ctx.viewerClientId && player.clientId === ctx.viewerClientId) {
    tags.push({ key: "YOU", label: "YOU", tone: "neutral" })
  }
  if (player.isSpectator) {
    tags.push({ key: "SPECTATOR", label: "SPECTATOR", tone: "warning" })
    return tags
  }

  if (!player.alive) {
    tags.push({ key: "DEAD", label: "DEAD", tone: "danger" })
  }

  return tags
}
