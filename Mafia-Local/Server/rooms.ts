import type { Server as SocketIOServer } from "socket.io"
import type { Socket } from "socket.io"
import {  mergePlayerState, removePlayer, setAlive as setAliveList,  setRole as setRoleList,  setStatus as setStatusList, } from "./players.js"
import type { Player, PlayerRole, PlayerStatus } from "./players.js"




type Room = {
  hostId: string
  players: Player[]
}

export const createRoomsManager = (io: SocketIOServer) => {
  const rooms: Record<string, Room> = {}

  const normalizeRoomId = (roomId: string) => (roomId || "").trim().toUpperCase()
  const normalizeName = (name: string) => (name || "").trim()

  // Helper: broadcast room state
  const emitRoomState = (roomId: string) => {
    const room = rooms[roomId]
    if (!room) return

    io.to(roomId).emit("roomState", {
      roomId,
      hostId: room.hostId,
      players: room.players,
    })
  }

  // Helper: removes socket from all rooms
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
        // If room is now empty, delete it and emit []
        if (room.players.length === 0) {
          delete rooms[roomId]
          io.to(roomId).emit("roomClosed", { roomId })
        } else {
          emitRoomState(roomId)
        }
      }
    }
  }

  const handleDisconnecting = (socket: Socket) => {
    for (const roomId of socket.rooms) {
      // socket.rooms always includes socket.id — ignore it
      if (roomId === socket.id) continue

      const room = rooms[roomId]
      if (!room) continue

      // Remove player
      room.players = removePlayer(room.players, socket.id)

      // If host left, transfer host to first remaining player
      if (room.hostId === socket.id) {
        room.hostId = room.players[0]?.id ?? ""
      }

      // If room is empty, delete it
      if (room.players.length === 0) {
        delete rooms[roomId]
        io.to(roomId).emit("roomClosed", { roomId })
        continue
      }

      // Otherwise, broadcast updated room state
      emitRoomState(roomId)
    }
  }

  const createRoomLocal = (socket: Socket, roomId: string, playerName: string) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const cleanName = normalizeName(playerName)
    if (!cleanRoomId || !cleanName) return

    // remove from other rooms FIRST (skip the one we are creating/joining)
    removeFromAllRooms(socket.id, cleanRoomId)

    // ensure room exists
    if (!rooms[cleanRoomId]) rooms[cleanRoomId] = { hostId: socket.id, players: [] }
    const room = rooms[cleanRoomId]
    if (!room) return

    // join room
    socket.join(cleanRoomId)

    // avoid duplicates if user hits join twice / reconnects
    const existing = room.players.find((p) => p.id === socket.id)
    room.players = room.players.filter((p) => p.id !== socket.id)
    room.players.push(mergePlayerState(existing, socket.id, cleanName))

    emitRoomState(cleanRoomId)
  }

  const joinRoomLocal = (socket: Socket, roomId: string, playerName: string) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const cleanName = normalizeName(playerName)
    if (!cleanRoomId || !cleanName) return

    // remove from other rooms FIRST (skip the one we are joining)
    removeFromAllRooms(socket.id, cleanRoomId)

    // ensure room exists
    if (!rooms[cleanRoomId]) rooms[cleanRoomId] = { hostId: socket.id, players: [] }

    const room = rooms[cleanRoomId]
    if (!room) return // extra safety

    // join room
    socket.join(cleanRoomId)

    // avoid duplicates if user hits join twice / reconnects
    const existing = room.players.find((p) => p.id === socket.id)
    room.players = room.players.filter((p) => p.id !== socket.id)
    room.players.push(mergePlayerState(existing, socket.id, cleanName))

    emitRoomState(cleanRoomId)
  }

  const leaveRoomLocal = (socket: Socket, roomId: string) => {
    if (!roomId) return
    const cleanRoomId = normalizeRoomId(roomId)

    socket.leave(cleanRoomId)

    const room = rooms[cleanRoomId]
    if (!room) return

    room.players = removePlayer(room.players, socket.id)

    if (room.hostId === socket.id) {
      room.hostId = room.players[0]?.id ?? ""
    }

    // If empty, delete FIRST, and emit an empty list safely
    if (room.players.length === 0) {
      delete rooms[cleanRoomId]
      io.to(cleanRoomId).emit("roomClosed", { roomId: cleanRoomId })
      return
    }

    // Otherwise emit the updated list
    emitRoomState(cleanRoomId)
  }

  // --- New: player state mutations (server-authoritative) ---
  const setPlayerAlive = (roomId: string, playerId: string, alive: boolean) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return

    room.players = setAliveList(room.players, playerId, alive)
    emitRoomState(cleanRoomId)
  }

  const setPlayerRole = (roomId: string, playerId: string, role: PlayerRole) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return

    room.players = setRoleList(room.players, playerId, role)
    emitRoomState(cleanRoomId)
  }

  const setPlayerStatus = (roomId: string, playerId: string, status: PlayerStatus) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return

    room.players = setStatusList(room.players, playerId, status)
    emitRoomState(cleanRoomId)
  }

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
  }
}
