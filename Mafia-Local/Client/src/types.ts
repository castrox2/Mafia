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
    | "RADY" // not if dead or alive

export type Player = {
    id: string // Socket ID
    name: string
    alive: boolean
    role: PlayerRole
    status: PlayerStatus
    joinedAt: number // timestamp for when player joined
}

export type RoomState = {
    roomId: string
    hostId: string
    players: Player[]
}