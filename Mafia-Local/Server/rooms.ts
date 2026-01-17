import type { Server as SocketIOServer } from "socket.io"

// Room types
type Player = {
  id: string
  name: string
}

type Room = {
  hostId: string
  players: Player[]
}

export const createRoomsManager = (io: SocketIOServer) => {
  const rooms: Record<string, Room> = {}

  // Helper: removes socket from all rooms
  const removeFromAllRooms = (socketId: string, skipRoomId?: string) => {
    const skip = skipRoomId ? skipRoomId.trim().toUpperCase() : undefined

    for (const roomId of Object.keys(rooms)) {
      if (skip && roomId === skip) continue

      const room = rooms[roomId]
      if (!room) continue

      const before = room.players.length

      // Remove player
      room.players = room.players.filter((p) => p.id !== socketId)

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

  // Helper: broadcast room state
  const emitRoomState = (roomId: string) => {
    const room = rooms[roomId]
    if (!room) return

    io.to(roomId).emit("roomState", {
      roomId,
      hostId: room.hostId,
      players: room.players
    })
  }

  const handleDisconnecting = (socket: any) => {
    for (const roomId of socket.rooms) {
      // socket.rooms always includes socket.id — ignore it
      if (roomId === socket.id) continue

      const room = rooms[roomId]
      if (!room) continue

      // Remove player
      room.players = room.players.filter((p) => p.id !== socket.id)

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

  const createRoomLocal = (socket: any, roomId: string, playerName: string) => {
    const cleanRoomId = (roomId || "").trim().toUpperCase()
    const cleanName = (playerName || "").trim()

    if (!cleanRoomId || !cleanName) return

    // remove from other rooms FIRST (skip the one we are creating/joining)
    removeFromAllRooms(socket.id, cleanRoomId)

    // ensure room exists
    if (!rooms[cleanRoomId]) rooms[cleanRoomId] = { hostId: socket.id, players: [] }
    const room = rooms[cleanRoomId]
    if (!room) return

    // join room
    socket.join(cleanRoomId)

    // add player as first member
    room.players = room.players.filter((p) => p.id !== socket.id)
    room.players.push({ id: socket.id, name: cleanName })

    emitRoomState(cleanRoomId)
  }

  const joinRoomLocal = (socket: any, roomId: string, playerName: string) => {
    const cleanRoomId = (roomId || "").trim().toUpperCase()
    const cleanName = (playerName || "").trim()

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
    room.players = room.players.filter((p) => p.id !== socket.id)
    room.players.push({ id: socket.id, name: cleanName })

    emitRoomState(cleanRoomId)
  }

  const leaveRoomLocal = (socket: any, roomId: string) => {
    if (!roomId) return

    const cleanRoomId = roomId.trim().toUpperCase()

    socket.leave(cleanRoomId)

    const room = rooms[cleanRoomId]
    if (!room) return

    room.players = room.players.filter((p) => p.id !== socket.id)

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

  return {
    rooms,
    removeFromAllRooms,
    emitRoomState,
    handleDisconnecting,
    createRoomLocal,
    joinRoomLocal,
    leaveRoomLocal
  }
}
