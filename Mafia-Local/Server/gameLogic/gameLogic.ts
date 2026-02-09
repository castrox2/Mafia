import type { Player, PlayerRole } from "../players.js"

type Room = { players: Player[] }
type Rooms = Record<string, Room>

// Clean roomid
export const normalizeRoomId = (roomId: string): string => (roomId || "").trim().toUpperCase()

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

// Player list lookup (used by pure role resolvers)
export const getPlayerFromListByClientId = (
  players: Player[],
  clientId: string
): Player | null => {
  return players.find((p) => p.clientId === clientId) ?? null
}

export const isPlayerActive = (player: Player): boolean => player.isSpectator !== true
export const isPlayerAlive = (player: Player): boolean => player.alive === true
export const isPlayerRole = (player: Player, role: PlayerRole): boolean => player.role === role

/* ======================================================
Simple Player state updates
    - Functions below are foundation for role logic
====================================================== */

// Set/update player's alive status
export const setPlayerAliveStatus = (
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

export const returnPlayerRole = (
    rooms: Rooms,
    roomId: string,
    clientId: string,
): string | boolean => {
    const player = getPlayerByClientId(rooms, roomId, clientId)
    if (!player) return false

    return player.role
}

export const returnPlayerAliveStatus = (
    rooms: Rooms,
    roomId: string,
    clientId: string,
): string | boolean => {
    const player = getPlayerByClientId(rooms, roomId, clientId)
    if (!player) return false

    return player.alive
}

export const returnPlayerVoteCount = (
    rooms: Rooms,
    roomId: string,
    clientId: string,
): number | boolean => {
    const player = getPlayerByClientId(rooms, roomId, clientId)
    if (!player) return false

    return player.voteCount
}


/* ======================================================
Role assignment (prototype)
    - mafiaMax = floor(players/4)
    - doctor, sheriff and detective roles added based on boolean parameter
====================================================== */

export const randomizePlayerRoles = (rooms: Rooms, roomId: string, addDoctorRole:boolean, addSheriffRole: boolean, addDetectiveRole: boolean): boolean => {
  const room = rooms[normalizeRoomId(roomId)]
  if (!room) return false

  // Only assign roles among ACTIVE players (not spectators) if your Player type supports it
  const activePlayers = room.players.filter((p) => isPlayerActive(p))

  const playerCount = activePlayers.length
  if (playerCount === 0) return false

  const mafiaMax = Math.floor(playerCount / 4)
  let mafiaCount = 0

  while (mafiaCount < mafiaMax) {
    const player = activePlayers[Math.floor(Math.random() * playerCount)]
    if (!player) return false

    if (player.role === "CIVILIAN") {
        player.role = "MAFIA"
        mafiaCount++;
    } 
  }

  if (addDoctorRole) {
    let doctorCount = 0;
    while (doctorCount < 1) {
        const player = activePlayers[Math.floor(Math.random() * playerCount)]
        if (!player) return false

        if (player.role === "CIVILIAN") {
            player.role = "DOCTOR"
            doctorCount++;
        } 
    }
  }

  if (addSheriffRole) {
    let sheriffCount = 0;
    while (sheriffCount < 1) {
        const player = activePlayers[Math.floor(Math.random() * playerCount)]
        if (!player) return false

        if (player.role === "CIVILIAN") {
            player.role = "SHERIFF"
            sheriffCount++;
        } 
    }
  }

  if (addDetectiveRole) {
    let detectiveCount = 0;
    while (detectiveCount < 1) {
        const player = activePlayers[Math.floor(Math.random() * playerCount)]
        if (!player) return false

        if (player.role === "CIVILIAN") {
            player.role = "DETECTIVE"
            detectiveCount++;
        } 
    }
  }

  return true
}

/* ======================================================
Basic Vote Function
    - Feed a player list, then return most voted player(s)
====================================================== */

export const countPlayerVotes = (players: Player[]): Player[] | false => {

  const activePlayers = players.filter((p) => isPlayerActive(p))

  const playerCount = activePlayers.length
  if (playerCount === 0) return false

  let votedPlayers: Player[] = []
  const maxVotes = Math.max(...activePlayers.map((player) => player.voteCount))

  votedPlayers = activePlayers.filter((player) => player.voteCount === maxVotes)

  return votedPlayers
}
