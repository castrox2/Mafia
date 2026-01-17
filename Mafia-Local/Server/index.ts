import express from "express"
import http from "http"
import { Server as SocketIOServer } from "socket.io"
import { generateRoomCode, generateRoomJoinQrDataUrl } from "./utils/generateRoomCode.js"
import os from "os"
import { createRoomsManager } from "./rooms.js"

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

// Middleware to force no-cahing for Safari
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store")
  next()
})

// serve static files from the "public" directory
app.use(express.static("public", { etag: false, maxAge: 0 }))

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

      // remove from other rooms FIRST (skip the one we are creating/joining)
      roomsManager.removeFromAllRooms(socket.id, roomId)

      // ensure room exists + join + add player + emit state
      roomsManager.createRoomLocal(socket, roomId, cleanName)

      const lanBaseUrl = `http://${getLanIp()}:3000`
      const { joinUrl, qrDataUrl } = await generateRoomJoinQrDataUrl(lanBaseUrl, roomId)

      // Tell ONLY this socket what the room code is
      socket.emit("roomCreated", { roomId, joinUrl, qrDataUrl })
    }
  )

  socket.on(
    "joinRoom",
    ({ roomId, playerName }: { roomId: string; playerName: string }) => {
      roomsManager.joinRoomLocal(socket, roomId, playerName)
    }
  )

  socket.on("leaveRoom", (roomId: string) => {
    roomsManager.leaveRoomLocal(socket, roomId)
  })

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id)
    roomsManager.removeFromAllRooms(socket.id)
  })
})

// server starts listening
server.listen(3000, () => {
  console.log("Server listening on http://localhost:3000")
})
