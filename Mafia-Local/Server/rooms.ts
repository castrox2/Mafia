import type { Server as SocketIOServer } from "socket.io"
import type { Socket } from "socket.io"

import {
  mergePlayerState,
  removePlayer,
  setAlive as setAliveList,
  setRole as setRoleList,
  setStatus as setStatusList,
} from "./players.js"

import type { Player, PlayerRole, PlayerStatus } from "./players.js"

/* ======================================================
                          Types
====================================================== */

export type PhaseTimers = {
  daySec: number
  nightSec: number
  voteSec: number
  discussionSec: number
  pubDiscussionSec: number
}

export type RoleCount = {
  mafia: number
  doctor: number
  detective: number
  sheriff: number
}

export type GameSettings = {
  timers: PhaseTimers
  roleCount: RoleCount
}

type Room = {
  hostId: string
  players: Player[]
  settings: GameSettings
}

/* ======================================================
                    Rooms Manager
====================================================== */

export const createRoomsManager = (io: SocketIOServer) => {
  const rooms: Record<string, Room> = {}

  /* ------------------------------------------------------
                  Normalization helpers
  ------------------------------------------------------ */

  const normalizeRoomId = (roomId: string) =>
    (roomId || "").trim().toUpperCase()

  const normalizeName = (name: string) =>
    (name || "").trim()

  /* ------------------------------------------------------
                  Default Game Settings
  ------------------------------------------------------ */

  const defaultSettings = (): GameSettings => ({
    timers: {
      daySec: 300,
      nightSec: 180,
      voteSec: 120,
      discussionSec: 180,
      pubDiscussionSec: 120,
    },
    roleCount: {
      mafia: 1,
      doctor: 0,
      detective: 0,
      sheriff: 0,
    },
  })

  /* ------------------------------------------------------
            Role Bounds (based on player count)
            - Mafia is ALWAYS at least 1
            - Doctor / Detective / Sheriff can be 0+
  ------------------------------------------------------ */

  const getRoleBounds = (playerCount: number) => {
    if (playerCount < 5) {
      return {
        mafia: { min: 1, max: 1 },
        doctor: { min: 0, max: 1 },
        detective: { min: 0, max: 1 },
        sheriff: { min: 0, max: 1 },
      }
    }

    if (playerCount <= 7) {
      return {
        mafia: { min: 1, max: 2 },
        doctor: { min: 0, max: 1 },
        detective: { min: 0, max: 1 },
        sheriff: { min: 0, max: 1 },
      }
    }

    if (playerCount <= 10) {
      return {
        mafia: { min: 2, max: 3 },
        doctor: { min: 0, max: 1 },
        detective: { min: 0, max: 1 },
        sheriff: { min: 0, max: 1 },
      }
    }

    if (playerCount <= 12) {
      return {
        mafia: { min: 3, max: 4 },
        doctor: { min: 0, max: 1 },
        detective: { min: 0, max: 1 },
        sheriff: { min: 0, max: 1 },
      }
    }

    if (playerCount <= 14) {
      return {
        mafia: { min: 4, max: 5 },
        doctor: { min: 0, max: 1 },
        detective: { min: 0, max: 1 },
        sheriff: { min: 0, max: 1 },
      }
    }

    // playerCount >= 15
    return {
      mafia: { min: 5, max: 6 },
      doctor: { min: 0, max: 2 },
      detective: { min: 0, max: 2 },
      sheriff: { min: 0, max: 2 },
    }
  }

    /* ------------------------------------------------------
                      Helper: Settings
  ------------------------------------------------------ */

  const clampInt = (n: number, min: number, max: number): number => {
    return Math.min(Math.max(n, min), max)
  }

  const normalizeTimers = (timers: Partial<PhaseTimers> | undefined, current: PhaseTimers): PhaseTimers => ({
      daySec: clampInt(timers?.daySec ?? current.daySec, 10, 3600),
      nightSec: clampInt(timers?.nightSec ?? current.nightSec, 10, 3600),
      voteSec: clampInt(timers?.voteSec ?? current.voteSec, 10, 3600),
      discussionSec: clampInt(timers?.discussionSec ?? current.discussionSec, 10, 3600),
      pubDiscussionSec: clampInt(timers?.pubDiscussionSec ?? current.pubDiscussionSec, 10, 3600),
  })

  const normalizeRoleCount = (r: Partial<RoleCount> | undefined, current: RoleCount, playerCount: number, bounds: ReturnType<typeof getRoleBounds>): 
  RoleCount => {
    // Clamp each role count within bounds
      let mafia = clampInt(r?.mafia ?? current.mafia, bounds.mafia.min, bounds.mafia.max)
      let doctor = clampInt(r?.doctor ?? current.doctor, bounds.doctor.min, bounds.doctor.max)
      let detective = clampInt(r?.detective ?? current.detective, bounds.detective.min, bounds.detective.max)
      let sheriff = clampInt(r?.sheriff ?? current.sheriff, bounds.sheriff.min, bounds.sheriff.max)

      // Ensure total roles do not exceed player count
      // If they do, reduce each role proportionally

      const total = () => mafia + doctor + detective + sheriff
      while (total() > playerCount) {
        if (sheriff > bounds.sheriff.min) sheriff--
        else if (detective > bounds.detective.min) detective--
        else if (doctor > bounds.doctor.min) doctor--
        else if (mafia > bounds.mafia.min) mafia--
        else break
      }

      // Always Enforce at least 1 Mafia
      mafia: Math.max(mafia, 1)

      return { mafia, doctor, detective, sheriff }
  }

  /* ------------------------------------------------------
                Helper: broadcast room state
  ------------------------------------------------------ */

  const emitRoomState = (roomId: string) => {
    const room = rooms[roomId]
    if (!room) return

    io.to(roomId).emit("roomState", {
      roomId,
      hostId: room.hostId,
      players: room.players,
      settings: room.settings,
      roleBounds: getRoleBounds(room.players.length),
    })
  }

  /* ------------------------------------------------------
          Helper: removes socket from all rooms
  ------------------------------------------------------ */

  const removeFromAllRooms = (socketId: string, skipRoomId?: string) => {
    const skip = skipRoomId ? normalizeRoomId(skipRoomId) : undefined

    for (const roomId of Object.keys(rooms)) {
      if (skip && roomId === skip) continue

      const room = rooms[roomId]
      if (!room) continue

      const before = room.players.length

      room.players = removePlayer(room.players, socketId)

      // If host leaves, assign new host
      if (room.hostId === socketId) {
        room.hostId = room.players[0]?.id ?? ""
      }

      if (before !== room.players.length) {
        // If room is now empty, delete it
        if (room.players.length === 0) {
          delete rooms[roomId]
          io.to(roomId).emit("roomClosed", { roomId })
        } else {
          emitRoomState(roomId)
        }
      }
    }
  }

  /* ------------------------------------------------------
                Socket lifecycle cleanup
  ------------------------------------------------------ */

  const handleDisconnecting = (socket: Socket) => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue

      const room = rooms[roomId]
      if (!room) continue

      room.players = removePlayer(room.players, socket.id)

      // Transfer host if needed
      if (room.hostId === socket.id) {
        room.hostId = room.players[0]?.id ?? ""
      }

      if (room.players.length === 0) {
        delete rooms[roomId]
        io.to(roomId).emit("roomClosed", { roomId })
        continue
      }

      emitRoomState(roomId)
    }
  }

  /* ------------------------------------------------------
                        Create Room
  ------------------------------------------------------ */

  const createRoomLocal = (
    socket: Socket,
    roomId: string,
    playerName: string
  ) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const cleanName = normalizeName(playerName)
    if (!cleanRoomId || !cleanName) return

    rooms[cleanRoomId] = {
      hostId: socket.id,
      players: [],
      settings: defaultSettings(),
    }

    removeFromAllRooms(socket.id, cleanRoomId)

    socket.join(cleanRoomId)

    rooms[cleanRoomId].players.push(
      mergePlayerState(undefined, socket.id, cleanName)
    )

    emitRoomState(cleanRoomId)
  }

  /* ------------------------------------------------------
                Host Settings Update Live
  ------------------------------------------------------ */

  /* ------------------------------------------------------
                        Join Room
  ------------------------------------------------------ */

  const joinRoomLocal = (
    socket: Socket,
    roomId: string,
    playerName: string
  ) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const cleanName = normalizeName(playerName)
    if (!cleanRoomId || !cleanName) return

    // Room code validation
    if (cleanRoomId.length !== 5) {
      socket.emit("roomInvalid", {
        reason: "Room Code MUST Be 5 Characters Long",
      })
      return
    }

    if (!/^[A-Z0-9]{5}$/.test(cleanRoomId)) {
      socket.emit("roomInvalid", {
        reason: "Room Code MUST Be Alphanumeric (A-Z, 0-9)",
      })
      return
    }

    const room = rooms[cleanRoomId]
    if (!room) {
      socket.emit("roomInvalid", { reason: "Room Does Not Exist" })
      return
    }

    removeFromAllRooms(socket.id, cleanRoomId)

    socket.join(cleanRoomId)

    const existing = room.players.find((p) => p.id === socket.id)
    room.players = room.players.filter((p) => p.id !== socket.id)
    room.players.push(
      mergePlayerState(existing, socket.id, cleanName)
    )

    emitRoomState(cleanRoomId)
  }

  /* ------------------------------------------------------
                        Leave Room
  ------------------------------------------------------ */

  const leaveRoomLocal = (socket: Socket, roomId: string) => {
    const cleanRoomId = normalizeRoomId(roomId)
    socket.leave(cleanRoomId)

    const room = rooms[cleanRoomId]
    if (!room) return

    room.players = removePlayer(room.players, socket.id)

    if (room.hostId === socket.id) {
      room.hostId = room.players[0]?.id ?? ""
    }

    if (room.players.length === 0) {
      delete rooms[cleanRoomId]
      io.to(cleanRoomId).emit("roomClosed", { roomId: cleanRoomId })
      return
    }

    emitRoomState(cleanRoomId)
  }

  /* ------------------------------------------------------
        Player State Mutations (server-authoritative)
  ------------------------------------------------------ */

  const setPlayerAlive = (roomId: string, playerId: string, alive: boolean) => {
    const room = rooms[normalizeRoomId(roomId)]
    if (!room) return
    room.players = setAliveList(room.players, playerId, alive)
    emitRoomState(roomId)
  }

  const setPlayerRole = (roomId: string, playerId: string, role: PlayerRole) => {
    const room = rooms[normalizeRoomId(roomId)]
    if (!room) return
    room.players = setRoleList(room.players, playerId, role)
    emitRoomState(roomId)
  }

  const setPlayerStatus = (
    roomId: string,
    playerId: string,
    status: PlayerStatus
  ) => {
    const room = rooms[normalizeRoomId(roomId)]
    if (!room) return
    room.players = setStatusList(room.players, playerId, status)
    emitRoomState(roomId)
  }

    const updateRoomSettings = ( socket: Socket, roomId: string, settings: Partial<GameSettings> ) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return

    // Host-only
    if (room.hostId !== socket.id) {
      socket.emit("settingsRefused", { reason: "Only the host can update settings." })
      return
    }

    const playerCount = room.players.length
    const bounds = getRoleBounds(playerCount)
    if (!bounds) return

    const next: GameSettings = {
      timers: normalizeTimers(settings.timers, room.settings.timers),
      roleCount: normalizeRoleCount(settings.roleCount, room.settings.roleCount, playerCount, bounds),
    }

    room.settings = next
    emitRoomState(cleanRoomId)
  }

  /* ------------------------------------------------------
                        Public API
  ------------------------------------------------------ */

  return {
    rooms,
    emitRoomState,
    removeFromAllRooms,
    handleDisconnecting,
    createRoomLocal,
    joinRoomLocal,
    leaveRoomLocal,
    setPlayerAlive,
    setPlayerRole,
    setPlayerStatus,
    updateRoomSettings,
  }
}
