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
    clientId: string // Persistent client ID
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
    settings: GameSettings
    phase: "DAY" | "NIGHT" | "VOTE" | "DISCUSSION" | "PUB_DISCUSSION"
    phaseEndTime: number | null
    gameStarted: boolean
    gameNumber: number

}

export type PhaseTimers = {
    daySec: number
    nightSec: number
    voteSec: number
    discussionSec: number
    pubDiscussionSec: number
}

export type RoleCounts = {
    mafia: number
    doctor: number
    detective: number
    sheriff: number
}

export type GameSettings = {
    roleCount: any
    timers: PhaseTimers
    roles: RoleCounts
}
