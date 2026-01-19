import express from "express"
import http from "http"
import { Server as SocketIOServer } from "socket.io"
import { generateRoomCode, generateRoomJoinQrDataUrl } from "./utils/generateRoomCode.js"
import os from "os"
import { createRoomsManager } from "./rooms.js"
import type { PlayerRole, PlayerStatus } from "./players.js"

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err)
})

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason)
})

const app = express()
const server = http.createServer(app)

const io = new SocketIOServer(server, {
  cors: { origin: "*" },
})

// serve static files from the "public" directory
app.use(express.static("public"))

// Health check endpoint
app.get("/health", (req, res) => {
  res.send("OK")
})

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

const roomsManager = createRoomsManager(io)

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id)

  socket.on("disconnecting", () => {
    roomsManager.handleDisconnecting(socket)
  })

  socket.on(
    "createRoom",
    async ({ playerName, baseUrl }: { playerName: string; baseUrl: string }) => {
      const cleanName = (playerName || "").trim()
      const cleanBaseUrl = (baseUrl || "").trim()

      if (!cleanName) return
      if (!cleanBaseUrl) return

      // Create a new unique room code
      const roomId = generateRoomCode(roomsManager.rooms)

      // ensure room exists + join + add player + emit state
      roomsManager.createRoomLocal(socket, roomId, cleanName)

      const lanClientBaseUrl = `http://${getLanIp()}:5173`
      const { joinUrl, qrDataUrl } = await generateRoomJoinQrDataUrl(lanClientBaseUrl, roomId)

      // Tell ONLY this socket what the room code is
      socket.emit("roomCreated", { roomId, joinUrl, qrDataUrl })
    }
  )

  socket.on("joinRoom", ({ roomId, playerName }: { roomId: string; playerName: string }) => {
    roomsManager.joinRoomLocal(socket, roomId, playerName)
  })

  socket.on("leaveRoom", (roomId: string) => {
    roomsManager.leaveRoomLocal(socket, roomId)
  })

  // --- New: Player state updates ---

  // For testing: allow player to kill/revive themselves.
  // Later: restrict to host only / game rules.
  socket.on(
    "setAlive",
    ({ roomId, playerId, alive }: { roomId: string; playerId: string; alive: boolean }) => {
      roomsManager.setPlayerAlive(roomId, playerId, alive)
    }
  )

  // Host-only role assignment (recommended)
  socket.on(
    "setRole",
    ({ roomId, playerId, role }: { roomId: string; playerId: string; role: PlayerRole }) => {
      const cleanRoomId = (roomId || "").trim().toUpperCase()
      const room = roomsManager.rooms[cleanRoomId]
      if (!room) return

      if (room.hostId !== socket.id) return // host-only
      roomsManager.setPlayerRole(cleanRoomId, playerId, role)
    }
  )

  // Status can be used for ready/not-ready etc.
  socket.on(
    "setPlayerStatus",
    ({
      roomId,
      playerId,
      status,
    }: {
      roomId: string
      playerId: string
      status: PlayerStatus
    }) => {
      // For now allow host or self
      const cleanRoomId = (roomId || "").trim().toUpperCase()
      const room = roomsManager.rooms[cleanRoomId]
      if (!room) return

      if (room.hostId !== socket.id && playerId !== socket.id) return
      roomsManager.setPlayerStatus(cleanRoomId, playerId, status)
    }
  )

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id)
    roomsManager.removeFromAllRooms(socket.id)
  })
})

// server starts listening
server.listen(3000, "0.0.0.0", () => {
  console.log("Server listening on http://localhost:3000")
})
