import express from "express"
import http from "http"
import { Server as SocketIOServer } from "socket.io"
import { generateRoomCode, generateRoomJoinQrDataUrl } from "./utils/generateRoomCode.js"
import os from "os"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createRoomsManager } from "./rooms.js"
import { normalizeRoomId } from "../Shared/events.js"
import type {
  CreateRoomPayload,
  ImportBotcScriptPayload,
  JoinRoomPayload,
  KickPlayerPayload,
  MafiaClientToServerEvents,
  MafiaServerToClientEvents,
  MafiaSocketData,
  RoomIdPayload,
  SetAlivePayload,
  SetHostParticipationEvent,
  SetPlayerStatusPayload,
  SetRolePayload,
  SubmitRoleActionPayload,
  UpdateRoleSelectorSettingsPayload,
  UpdateSettingsPayload,
} from "../Shared/events.js"

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err)
})

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason)
})

const app = express()
const server = http.createServer(app)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const parsePort = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const SERVER_PORT = parsePort(process.env.MAFIA_SERVER_PORT || process.env.PORT, 3100)
const DEFAULT_DEV_CLIENT_PORT = 5173

const getResourcesPath = (): string => {
  const value = (process as any).resourcesPath
  return typeof value === "string" ? value : ""
}

const resolveClientDistDir = (): string | null => {
  const resourcesPath = getResourcesPath()
  const envDir = String(process.env.MAFIA_CLIENT_DIST_DIR || "").trim()

  const candidates = [
    envDir,
    path.join(__dirname, "..", "Client", "dist"),
    path.join(__dirname, "..", "..", "Client", "dist"),
    resourcesPath ? path.join(resourcesPath, "Client", "dist") : "",
    resourcesPath ? path.join(resourcesPath, "app", "Client", "dist") : "",
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      return candidate
    }
  }

  return null
}

const resolveServerPublicDir = (): string | null => {
  const candidates = [
    path.join(__dirname, "public"),
    path.join(__dirname, "..", "public"),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

const CLIENT_DIST_DIR = resolveClientDistDir()
const CLIENT_INDEX_PATH = CLIENT_DIST_DIR
  ? path.join(CLIENT_DIST_DIR, "index.html")
  : null
const CLIENT_PORT_FOR_JOIN_URL = parsePort(
  process.env.MAFIA_CLIENT_PORT,
  CLIENT_DIST_DIR ? SERVER_PORT : DEFAULT_DEV_CLIENT_PORT
)

const getClientPortFromBaseUrl = (baseUrl?: string): number => {
  const cleanBaseUrl = String(baseUrl || "").trim()
  if (!cleanBaseUrl) return CLIENT_PORT_FOR_JOIN_URL

  try {
    const parsedUrl = new URL(cleanBaseUrl)
    return parsePort(parsedUrl.port, CLIENT_PORT_FOR_JOIN_URL)
  } catch (_err) {
    return CLIENT_PORT_FOR_JOIN_URL
  }
}

const io = new SocketIOServer<
  MafiaClientToServerEvents,
  MafiaServerToClientEvents,
  Record<string, never>,
  MafiaSocketData
>(server, {
  cors: { origin: "*" },
})

const serverPublicDir = resolveServerPublicDir()
if (serverPublicDir) {
  app.use(express.static(serverPublicDir))
}

if (CLIENT_DIST_DIR) {
  app.use(express.static(CLIENT_DIST_DIR))
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.send("OK")
})

// Packaged app fallback: ensure "/" and deep links resolve to client app.
if (CLIENT_INDEX_PATH && fs.existsSync(CLIENT_INDEX_PATH)) {
  app.get("/", (_req, res) => {
    res.sendFile(CLIENT_INDEX_PATH)
  })

  app.get(/^\/(?!socket\.io\/|health$).*/, (_req, res) => {
    res.sendFile(CLIENT_INDEX_PATH)
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

const roomsManager = createRoomsManager(io)


io.on("connection", (socket) => {
  console.log("New client connected:", socket.id)

  // Stable client id from browser/electron (persists across refresh/reconnect)
  const clientId = String((socket.handshake as any).auth?.clientId || "").trim()
  socket.data.clientId = clientId || socket.id
  console.log("Client identity:", { socketId: socket.id, clientId: socket.data.clientId })

  // Reconect / Resume lobby
  // if this clientId was in a room before disconnect, re-add them
  roomsManager.handleReconnect(socket, socket.data.clientId)

  socket.on("disconnecting", () => {
    roomsManager.handleDisconnecting(socket)
  })

  socket.on(
    "createRoom",
    async ({ playerName, baseUrl, roomType }: CreateRoomPayload) => {
      const cleanName = (playerName || "").trim()

      if (!cleanName) return

      // Create a new unique room code
      const roomId = generateRoomCode(roomsManager.rooms)

      // ensure room exists + join + add player + emit state
      roomsManager.createRoomLocal(
        socket,
        roomId,
        cleanName,
        socket.data.clientId,
        roomType ?? "CLASSIC"
      )

      const clientPortForRoom = getClientPortFromBaseUrl(baseUrl)
      const lanClientBaseUrl = `http://${getLanIp()}:${clientPortForRoom}`
      const { joinUrl, qrDataUrl } = await generateRoomJoinQrDataUrl(lanClientBaseUrl, roomId)

      // Tell ONLY this socket what the room code is
      socket.emit("roomCreated", { roomId, joinUrl, qrDataUrl })
    }
  )

  socket.on("joinRoom", ({ roomId, playerName, expectedRoomType }: JoinRoomPayload) => {
    roomsManager.joinRoomLocal(
      socket,
      roomId,
      playerName,
      socket.data.clientId,
      expectedRoomType
    )
  })

  socket.on("leaveRoom", (roomId: string) => {
    roomsManager.leaveRoomLocal(socket, roomId)
  })

  // --- New: Player state updates ---

  // For testing: allow player to kill/revive themselves.
  // Later: restrict to host only / game rules.
  socket.on(
    "setAlive",
    ({ roomId, playerId, alive }: SetAlivePayload) => {
      roomsManager.setPlayerAlive(roomId, playerId, alive)
    }
  )

  // Host-only role assignment (recommended)
  socket.on(
    "setRole",
    ({ roomId, playerId, role }: SetRolePayload) => {
      const cleanRoomId = normalizeRoomId(roomId)
      const room = roomsManager.rooms[cleanRoomId]
      if (!room) return

      if (room.hostId !== socket.data.clientId) return // host-only
      roomsManager.setPlayerRole(cleanRoomId, playerId, role)
    }
  )

  socket.on(
    "updateSettings",
    ({ roomId, settings }: UpdateSettingsPayload) => {
      console.log("DEBUG: updateSettings called", { roomId, settings })
      roomsManager.updateRoomSettings(socket, roomId, settings)
    })

  socket.on(
    "updateRoleSelectorSettings",
    ({ roomId, settings }: UpdateRoleSelectorSettingsPayload) => {
      roomsManager.updateRoleSelectorSettingsLocal(socket, roomId, settings)
    }
  )

  socket.on("importBotcScript", (payload: ImportBotcScriptPayload) => {
    roomsManager.importBotcScriptLocal(socket, payload)
  })

  // Status can be used for ready/not-ready etc.
  socket.on(
    "setPlayerStatus",
    ({ roomId, playerId, status }: SetPlayerStatusPayload) => {
      // For now allow host or self
      const cleanRoomId = normalizeRoomId(roomId)
      const room = roomsManager.rooms[cleanRoomId]
      if (!room) return

      if (room.hostId !== socket.data.clientId && playerId !== socket.data.clientId) return
      roomsManager.setPlayerStatus(cleanRoomId, playerId, status)
    }
  )

  const onSetHostParticipation: SetHostParticipationEvent = (payload) => {
    roomsManager.setHostParticipationLocal(socket, payload)
  }
  socket.on("setHostParticipation", onSetHostParticipation)

  socket.on("requestMyActions", ({ roomId }: RoomIdPayload) => {
    roomsManager.requestMyActionsLocal(socket, roomId)
  })

  socket.on("requestRoomState", ({ roomId }: RoomIdPayload) => {
    roomsManager.emitRoomState(roomId)
    roomsManager.requestMyRoleLocal(socket, roomId)
  })

  socket.on("startGame", ({ roomId }: RoomIdPayload) => {
    roomsManager.startGameLocal(socket, roomId, { force: false })
  })

  socket.on("forceStartGame", ({ roomId }: RoomIdPayload) => {
    roomsManager.startGameLocal(socket, roomId, { force: true })
  })

  socket.on(
    "submitRoleAction",
    ({ roomId, kind, targetClientId }: SubmitRoleActionPayload) => {
      roomsManager.submitRoleActionLocal(socket, roomId, { kind, targetClientId })
    }
  )

  socket.on("requestMyRole", ({ roomId }: RoomIdPayload) => {
    roomsManager.requestMyRoleLocal(socket, roomId)
  })

  socket.on("redealRoleSelector", ({ roomId }: RoomIdPayload) => {
    roomsManager.redealRoleSelectorLocal(socket, roomId)
  })

  socket.on(
    "kickPlayer",
    ({ roomId, targetClientId }: KickPlayerPayload) => {
      roomsManager.kickPlayerLocal(socket, roomId, targetClientId)
    }
  )

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id)

    // IMPORTANT:
    // Do NOT hard-remove on disconnect.
    // Browser refresh triggers a disconnect + reconnect, and we want handleReconnect() to restore them.
    // Cleanup should be handled by:
    // - explicit leaveRoom (user intent)
    // - a "disconnect grace period" (optional; can be added later)
  })
})

// server starts listening
server.listen(SERVER_PORT, () => {
  console.log(`Server listening on http://localhost:${SERVER_PORT}`)
  if (CLIENT_DIST_DIR) {
    console.log(`Serving client from ${CLIENT_DIST_DIR}`)
  }
})
