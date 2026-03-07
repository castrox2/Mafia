import type {
  MafiaPlayer,
  MafiaPlayerRole,
  MafiaPlayerStatus,
} from "../Shared/events.js"

export type PlayerRole = MafiaPlayerRole
export type PlayerStatus = MafiaPlayerStatus
export type Player = MafiaPlayer

export function createPlayer(id: string, name: string, clientId: string): Player {
    return {
        id,
        name,
        clientId,
        isBot: false,
        alive: true,
        role: "CIVILIAN",
        status: "CONNECTED",
        isSpectator: false,
        voteCount: 0,
        joinedAt: Date.now(),
    }
}

// Merges player state when same client rejoins (keeps role/alive/status)
export const mergePlayerState = (
  existing: Player | undefined,
  socketId: string,
  clientId: string,
  name: string
): Player => {
    const now = Date.now()

    // Preserve player's role, status, dead or alive state if this is a reconnect
  return {
    id: socketId,
    clientId,
    name,
    isBot: existing?.isBot ?? false,
    isSpectator: existing?.isSpectator ?? false,
    alive: existing?.alive ?? true,
    role: existing?.role ?? "CIVILIAN",
    status: existing?.status ?? "NOT READY",
    voteCount: existing?.voteCount ?? 0,
    joinedAt: existing?.joinedAt ?? now,
  }
}

// Remove by socketId (because disconnect event is for a connection)
export const removePlayer = (players: Player[], socketId: string): Player[] => {
  return players.filter((p) => p.id !== socketId)
}

export const setAlive = (players: Player[], clientId: string, alive: boolean): Player[] => {
  return players.map((p) => (p.clientId === clientId ? { ...p, alive } : p))
}

export const setRole = (players: Player[], clientId: string, role: PlayerRole): Player[] => {
  return players.map((p) => (p.clientId === clientId ? { ...p, role } : p))
}

export const setStatus = (players: Player[], clientId: string, status: PlayerStatus): Player[] => {
  return players.map((p) => (p.clientId === clientId ? { ...p, status } : p))
}
