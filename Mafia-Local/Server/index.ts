import express from "express"
import http from "http"
import { Server as SocketIOServer } from "socket.io"
import { generateRoomCode } from "./utils/generateRoomCode.js"

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
    room.players = room.players.filter((p) => p.id !== socketId)

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




io.on("connection", (socket) => {
  console.log("New client connected:", socket.id)

socket.on("createRoom", ({ playerName }: { playerName: string }) => {
  const cleanName = (playerName || "").trim()
  if (!cleanName) return

  // Create a new unique room code
  const roomId = generateRoomCode(rooms)

  // remove from other rooms FIRST (skip the one we are creating/joining)
  removeFromAllRooms(socket.id, roomId)

  // ensure room exists
  if (!rooms[roomId]) rooms[roomId] = { players: [] }
  const room = rooms[roomId]
  if (!room) return

  // join room
  socket.join(roomId)

  // add player as first member
  room.players = room.players.filter((p) => p.id !== socket.id)
  room.players.push({ id: socket.id, name: cleanName })

  // Tell ONLY this socket what the room code is
  socket.emit("roomCreated", { roomId })

  // Update the room list for everyone in the room (currently just host)
  io.to(roomId).emit("playerJoined", room.players)
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
    if (!rooms[cleanRoomId]) rooms[cleanRoomId] = { players: [] }

    const room = rooms[cleanRoomId]
    if (!room) return // extra safety

    // join room
    socket.join(cleanRoomId)

    // avoid duplicates if user hits join twice / reconnects
    room.players = room.players.filter((p) => p.id !== socket.id)
    room.players.push({ id: socket.id, name: cleanName })

    io.to(cleanRoomId).emit("playerJoined", room.players)
  }
)

socket.on("leaveRoom", (roomId: string) => {
  if (!roomId) return

  socket.leave(roomId)

  const room = rooms[roomId]
  if (!room) return

  room.players = room.players.filter((p) => p.id !== socket.id)

  // If empty, delete FIRST, and emit an empty list safely
  if (room.players.length === 0) {
    delete rooms[roomId]
    io.to(roomId).emit("playerLeft", [])
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
