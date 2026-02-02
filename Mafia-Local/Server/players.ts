export type PlayerRole=
    | "UNASSIGNED"
    | "MAFIA"
    | "CIVILIAN"
    | "DOCTOR"
    | "POLICE"  

export type PlayerStatus =
    | "DISCONNECTED"
    | "CONNECTED"
    | "NOT READY" // Checks if player is ready to start 
    | "READY" // not if dead or alive

export type Player = {
    id: string // Socket ID
    name: string
    clientId: string // Stable client ID (persists across reconnects)
    
    // Core Game State
    alive: boolean
    role: PlayerRole

    // General Status
    status: PlayerStatus

    // Optioanl metadata
    joinedAt: number // timestamp for when player joined
}

export function createPlayer(id: string, name: string): Player {
    return {
        id,
        name,
        clientId: id,
        alive: true,
        role: "UNASSIGNED",
        status: "CONNECTED",
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
    alive: existing?.alive ?? true,
    role: existing?.role ?? "CIVILIAN",
    status: existing?.status ?? "NOT READY",
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