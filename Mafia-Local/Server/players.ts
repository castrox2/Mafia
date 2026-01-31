import e from "express"

export type PlayerRole=
    | "UNASSIGNED"
    | "MAFIA"
    | "CIVILIAN"
    | "DOCTOR"
    | "POLICE"  

export type PlayerStatus =
    | "DISCONNECTED"
    | "CONNECTED"
    | "NOT_READY" // Checks if player is ready to start 
    | "READY" // not if dead or alive

export type Player = {
    id: string // Socket ID
    name: string
    
    // Core Game State
    alive: boolean
    role: PlayerRole

    // General Status
    status: PlayerStatus
    voteCount: number 

    // Optioanl metadata
    joinedAt: number // timestamp for when player joined
}

export function createPlayer(id: string, name: string): Player {
    return {
        id,
        name,
        alive: true,
        role: "CIVILIAN",
        status: "CONNECTED",
        voteCount: 0,
        joinedAt: Date.now(),
    }
}

// Keep existing state if player already exists (e.g., reconnect / rejoin)
export function mergePlayerState(existing: Player | undefined, id: string, name: string): Player {
  if (!existing) return createPlayer(id, name)

  return {
    ...existing,
    id,
    name, // allow name updates on rejoin
    status: "CONNECTED",
  }
}

export function setAlive(player: Player[], playerId: string, alive: boolean): Player[] {
    return player.map((p) => (p.id === playerId ? { ...p, alive } : p))
}

export function setRole(player: Player[], playerId: string, role: PlayerRole): Player[] {
    return player.map((p) => (p.id === playerId ? { ...p, role } : p))
}

export function setStatus(player: Player[], playerId: string, status: PlayerStatus): Player[] {
    return player.map((p) => (p.id === playerId ? { ...p, status } : p))
}

export function removePlayer(players: Player[], playerId: string): Player[] {
    return players.filter((p) => p.id !== playerId)
}