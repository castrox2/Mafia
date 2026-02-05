import type { Server } from "socket.io"
import type { Player, PlayerRole } from "../players.js"

type Room = { players: Player[] }
type Rooms = Record<string, Room>

// Clean roomid
const normalizeRoomId = (roomId: string): string => (roomId || "").trim().toUpperCase()

/* ======================================================
        Identity Note (Reconnect-safe)
  - player.id = socket.id (changes on refresh/reconnect)
  - player.clientId = stable identity (persists)
  - All game logic should use clientId.
====================================================== */

/* ------------------------------------------------------
                  Storage access
------------------------------------------------------ */

// Legacy: socket.id lookup (still useful sometimes)
export const getPlayerBySocketId = (
  rooms: Rooms,
  roomId: string,
  socketId: string
): Player | null => {
  const room = rooms[normalizeRoomId(roomId)]
  if (!room) return null

  return room.players.find((p) => p.id === socketId) ?? null
}

// Reconnect-safe: stable clientId lookup (preferred)
export const getPlayerByClientId = (
  rooms: Rooms,
  roomId: string,
  clientId: string
): Player | null => {
  const room = rooms[normalizeRoomId(roomId)]
  if (!room) return null

  return room.players.find((p) => p.clientId === clientId) ?? null
}

/* ======================================================
                  Player state updates
  - All functions below use clientId.
====================================================== */

// Set/update player's alive status
export const setPlayerAlive = (
  rooms: Rooms,
  roomId: string,
  clientId: string,
  alive: boolean
): boolean => {
  const player = getPlayerByClientId(rooms, roomId, clientId)
  if (!player) return false

  player.alive = alive
  return true
}

// Set player's vote count
export const setPlayerVoteCount = (
  rooms: Rooms,
  roomId: string,
  clientId: string,
  voteCount: number
): boolean => {
  const player = getPlayerByClientId(rooms, roomId, clientId)
  if (!player) return false

  player.voteCount = voteCount
  return true
}

// Increment player's vote count by 1
export const incrementPlayerVoteCount = (
  rooms: Rooms,
  roomId: string,
  clientId: string
): boolean => {
  const player = getPlayerByClientId(rooms, roomId, clientId)
  if (!player) return false

  player.voteCount++
  return true
}

// Set/update player role
export const setPlayerRole = (
  rooms: Rooms,
  roomId: string,
  clientId: string,
  role: PlayerRole
): boolean => {
  const player = getPlayerByClientId(rooms, roomId, clientId)
  if (!player) return false

  player.role = role
  return true
}

/* ======================================================
                  Role assignment (prototype)
  - NOTE: This is still a simple prototype:
    mafiaMax = floor(players/4)
  - You will likely replace this with your roleCount logic.
  - Uses stable clientId identity automatically.
====================================================== */

export const randomizePlayerRoles = (rooms: Rooms, roomId: string): boolean => {
  const room = rooms[normalizeRoomId(roomId)]
  if (!room) return false

  // Only assign roles among ACTIVE players (not spectators) if your Player type supports it
  const activePlayers = room.players.filter((p) => (p as any).isSpectator !== true)

  const playerCount = activePlayers.length
  if (playerCount === 0) return false

  const mafiaMax = Math.floor(playerCount / 4)

  for (let mafiaCount = 0; mafiaCount < mafiaMax; mafiaCount++) {
    const player = activePlayers[Math.floor(Math.random() * playerCount)]
    if (!player) return false

    if (player.role === "CIVILIAN") {
      player.role = "MAFIA"
    } else {
      mafiaCount--
    }
  }

  return true
}

/* ======================================================
                  Vote counting (prototype)
  - Fixes TS errors
  - Uses stable clientId identity
  - Current behavior:
    * tie => no one dies (returns false)
    * single winner => that player dies
====================================================== */

export const countPlayerVotes = (rooms: Rooms, roomId: string): boolean => {
  const room = rooms[normalizeRoomId(roomId)]
  if (!room) return false

  const activePlayers = room.players.filter((p) => (p as any).isSpectator !== true)

  const playerCount = activePlayers.length
  if (playerCount === 0) return false

  const votedPlayers: Player[] = []
  let mostVotes = 0

  for (const player of activePlayers) {
    if (votedPlayers.length === 0) {
      votedPlayers.push(player)
      mostVotes = player.voteCount
    } else if (player.voteCount > mostVotes) {
      votedPlayers.length = 0
      votedPlayers.push(player)
      mostVotes = player.voteCount
    } else if (player.voteCount === mostVotes) {
      votedPlayers.push(player)
    }
  }

  // Tie: no one dies (WIP)
  if (votedPlayers.length > 1) {
    return false
  }

  const top = votedPlayers[0]
  if (!top) return false

  // Re-fetch by clientId (stable) before mutating
  const target = getPlayerByClientId(rooms, roomId, top.clientId)
  if (!target) return false

  target.alive = false
  return true
}

/* ======================================================
                      Test emit
- Use socket id to emit is fine; clientId is for identity.
====================================================== */

export const emitPlayerStatus = (
  io: Server,
  clientId: string,
  status: "alive" | "dead"
): void => {
  io.emit("player:status", { clientId, status })
}
