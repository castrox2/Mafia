import express from "express"
import http from "http"
import { Server as SocketIOServer } from "socket.io"
import { generateRoomCode, generateRoomJoinQrDataUrl } from "./utils/generateRoomCode.js"
import os from "os"

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err)
})

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason)
})

const app = express()
const server = http.createServer(app)

const io = new SocketIOServer(server, {
  cors: { origin: "*" }
})

// serve static files from the "public" directory
app.use(express.static("public"))

// Health check endpoint
app.get("/health", (req, res) => {
  res.send("OK")
})

type Player = {
  id: string
  name: string
}

type Room = {
  hostId: string
  players: Player[]
}

const rooms: Record<string, Room> = {}

// Helper: removes socket from all rooms
const removeFromAllRooms = (socketId: string, skipRoomId?: string) => {
  const skip = skipRoomId ? skipRoomId.trim().toUpperCase() : undefined

  for (const roomId of Object.keys(rooms)) {
    if (skip && roomId === skip) continue

    const room = rooms[roomId]
    if (!room) continue

    const before = room.players.length
    // If host leaves, assign new host
    if (room.hostId === socketId) {
      room.hostId = room.players[0]?.id ?? ""
    }

    if (before !== room.players.length) {
      // If room is now empty, delete it and emit []
      if (room.players.length === 0) {
        delete rooms[roomId]
        io.to(roomId).emit("playerLeft", [])
      } else {
        io.to(roomId).emit("playerLeft", room.players)
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

// Helper:
function getLanIp(): string { 
  const nets = os.networkInterfaces()

  for (const name of Object.keys(nets)) {
    const netInfo = nets[name]
    if (!netInfo) continue

    for (const net of netInfo) {
      // We only want IPv4, non-internal addresses
      if (net.family === "IPv4" && !net.internal) {
        return net.address
      }
    }
  }

  return "127.0.0.1"
}

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id)

socket.on("disconnecting", () => {
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
})


socket.on("createRoom", async ({ playerName, baseUrl }: { playerName: string; baseUrl: string }) => {
  const cleanName = (playerName || "").trim()
  const cleanBaseUrl = (baseUrl || "").trim()
  
  if (!cleanName) return
  if (!cleanBaseUrl) return

  // Create a new unique room code
  const roomId = generateRoomCode(rooms)

  // remove from other rooms FIRST (skip the one we are creating/joining)
  removeFromAllRooms(socket.id, roomId)

  // ensure room exists
  if (!rooms[roomId]) rooms[roomId] = { hostId: socket.id, players: [] }
  const room = rooms[roomId]
  if (!room) return

  // join room
  socket.join(roomId)

  // add player as first member
  room.players = room.players.filter((p) => p.id !== socket.id)
  room.players.push({ id: socket.id, name: cleanName })

  const lanBaseUrl = `http://${getLanIp()}:3000`
  const { joinUrl, qrDataUrl } = await generateRoomJoinQrDataUrl(lanBaseUrl, roomId)

  // Tell ONLY this socket what the room code is
  socket.emit("roomCreated", { roomId, joinUrl, qrDataUrl })
  emitRoomState(roomId)
})


socket.on(
  "joinRoom",
  ({ roomId, playerName }: { roomId: string; playerName: string }) => {
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
)

socket.on("leaveRoom", (roomId: string) => {
  if (!roomId) return

  socket.leave(roomId)

  const room = rooms[roomId]
  if (!room) return

  room.players = room.players.filter((p) => p.id !== socket.id)

  if (room.hostId === socket.id) {
    room.hostId = room.players[0]?.id ?? ""
  }

  // If empty, delete FIRST, and emit an empty list safely
  if (room.players.length === 0) {
    delete rooms[roomId]
    emitRoomState(roomId)
    return
  }

  // Otherwise emit the updated list
  io.to(roomId).emit("playerLeft", room.players)
})


  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id)
    removeFromAllRooms(socket.id)
  })
})

// server starts listening
server.listen(3000, () => {
  console.log("Server listening on http://localhost:3000")
})
