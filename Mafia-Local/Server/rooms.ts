import type { Server as SocketIOServer } from "socket.io"
import type { Socket } from "socket.io"
import type { MafiaKillVoteAction, DoctorSaveAction } from "./roles/types.js"
import type { Player, PlayerRole, PlayerStatus } from "./players.js"

import {
  mergePlayerState,
  removePlayer,
  setAlive as setAliveList,
  setRole as setRoleList,
  setStatus as setStatusList,
} from "./players.js"

import {
  getRoleActions,
  clearRoleActions,
  recordRoleAction,
  getDoctorSelfSaveUsed,
  markDoctorSelfSaveUsed,
} from "./roles/index.js"

import { resolveNightPhase } from "./roles/night.js"

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

export type Phase = 
  | "LOBBY" 
  | "DAY" 
  | "DISCUSSION" 
  | "PUBDISCUSSION" 
  | "VOTING" 
  | "NIGHT" 
  | "GAMEOVER"

export type GameSettings = {
  timers: PhaseTimers
  roleCount: RoleCount
}

type Room = {
  hostId: string
  players: Player[]
  settings: GameSettings

  // Game State
  gameStarted: boolean
  gameNumber: number

  // Current Phase
  phase: Phase
  phaseEndTime: number | null // timestamp ms

  // Phase Scheduling
  phaseTimeoutId?: NodeJS.Timeout | null
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
    const x = Number.isFinite(n) ? Math.floor(n) : min
    return Math.min(Math.max(x, min), max)
  }

  const normalizeTimers = (
    timers: Partial<PhaseTimers> | undefined,
    current: PhaseTimers
  ): PhaseTimers => ({
    daySec: clampInt(timers?.daySec ?? current.daySec, 10, 3600),
    nightSec: clampInt(timers?.nightSec ?? current.nightSec, 10, 3600),
    voteSec: clampInt(timers?.voteSec ?? current.voteSec, 10, 3600),
    discussionSec: clampInt(
      timers?.discussionSec ?? current.discussionSec,
      10,
      3600
    ),
    pubDiscussionSec: clampInt(
      timers?.pubDiscussionSec ?? current.pubDiscussionSec,
      10,
      3600
    ),
  })

  const normalizeRoleCount = (
    r: Partial<RoleCount> | undefined,
    current: RoleCount,
    playerCount: number,
    bounds: ReturnType<typeof getRoleBounds>
  ): RoleCount => {
    // Clamp each role count within bounds
    let mafia = clampInt(r?.mafia ?? current.mafia, bounds.mafia.min, bounds.mafia.max)
    let doctor = clampInt(r?.doctor ?? current.doctor, bounds.doctor.min, bounds.doctor.max)
    let detective = clampInt(r?.detective ?? current.detective, bounds.detective.min, bounds.detective.max)
    let sheriff = clampInt(r?.sheriff ?? current.sheriff, bounds.sheriff.min, bounds.sheriff.max)

    // Always Enforce at least 1 Mafia
    mafia = Math.max(mafia, bounds.mafia.min)

    // Ensure total roles do not exceed player count
    // If they do, reduce each role proportionally
    const total = () => mafia + doctor + detective + sheriff

    while (total() > playerCount) {
      // Reduce non-mafia first (so mafia doesn't get "mysteriously" lowered)
      if (sheriff > bounds.sheriff.min) sheriff--
      else if (detective > bounds.detective.min) detective--
      else if (doctor > bounds.doctor.min) doctor--
      else if (mafia > bounds.mafia.min) mafia--
      else break
    }

    // Re-enforce after reductions (just in case)
    mafia = Math.max(mafia, bounds.mafia.min)

    // If enforcing mafia pushed us over playerCount again, trim non-mafia again
    while (total() > playerCount) {
      if (sheriff > bounds.sheriff.min) sheriff--
      else if (detective > bounds.detective.min) detective--
      else if (doctor > bounds.doctor.min) doctor--
      else break
    }

    return { mafia, doctor, detective, sheriff }
  }

  /* ------------------------------------------------------
                Helper: broadcast room state
  ------------------------------------------------------ */

  const dedupePlayersByClientId = (players: Player[]) => {
    const map = new Map<string, Player>()
    for (const p of players) {
      const key = (p.clientId || "").trim()
      if (!key) continue
      // Keep the latest instance for that clientId
      map.set(key, p)
    }
    return Array.from(map.values())
  }

  const emitRoomState = (roomId: string) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return

    room.players = dedupePlayersByClientId(room.players)

    io.to(cleanRoomId).emit("roomState", {
      roomId: cleanRoomId,
      hostId: room.hostId,

      // IMPORTANT (anti-spoiler):
      // Never broadcast real roles in roomState during a running game.
      // Roles should be sent privately to each player later (separate event).
      players: room.players.map((p) => ({
        ...p,
        role: room.gameStarted ? "CIVILIAN" : p.role,
      })),

      settings: room.settings,
      roleBounds: getRoleBounds(room.players.length),
      gameStarted: room.gameStarted,
      gameNumber: room.gameNumber,
      phase: room.phase,
      phaseEndTime: room.phaseEndTime,
    })
  }

  const getPhaseDurationSec = (room: Room, phase: Phase): number => {
    if (phase === "DAY") return room.settings.timers.daySec
    if (phase === "DISCUSSION") return room.settings.timers.discussionSec
    if (phase === "PUBDISCUSSION") return room.settings.timers.pubDiscussionSec
    if (phase === "VOTING") return room.settings.timers.voteSec
    if (phase === "NIGHT") return room.settings.timers.nightSec
    if (phase === "GAMEOVER") return 0
    return 0
  }

  const nextPhase = (phase: Phase): Phase => {
    // Canonical loop:
    // LOBBY → DAY → DISCUSSION → PUBDISCUSSION → VOTING → NIGHT → DAY ...
    if (phase === "LOBBY") return "DAY"
    if (phase === "DAY") return "DISCUSSION"
    if (phase === "DISCUSSION") return "PUBDISCUSSION"
    if (phase === "PUBDISCUSSION") return "VOTING"
    if (phase === "VOTING") return "NIGHT"
    if (phase === "NIGHT") return "DAY"

    // GAMEOVER stays GAMEOVER unless you manually restart a new game
    return "GAMEOVER"
  }

    const clearPhaseTimeout = (room: Room) => {
    if (room.phaseTimeoutId) {
      clearTimeout(room.phaseTimeoutId)
      room.phaseTimeoutId = null
    }
  }

/* ------------------------------------------------------
              Helper: apply night resolution
  - Server-authoritative: applies the night kill to room state
  - Anti-spoiler: roomState already masks roles during gameStarted
  - Spectators cannot be targeted (resolver already filters)
------------------------------------------------------ */

  const applyNightResolution = (room: Room, cleanRoomId: string) => {
  // Pull buffered NIGHT actions
  // Pull buffered NIGHT actions (whatever shape your store uses)
  const actions = getRoleActions(cleanRoomId, "NIGHT")

  // Adapt to the minimal shape resolveNightPhase expects:
  // - fromClientId
  // - targetClientId

  // Your existing store appears to use:
  // - actorClientId (instead of fromClientId)
  // - targetClientId (same)
const mafiaVotes: MafiaKillVoteAction[] = actions
  .filter((a: any) => a?.kind === "MAFIA_KILL_VOTE")
  .map((a: any) => ({
    kind: "MAFIA_KILL_VOTE",
    roomId: cleanRoomId,
    fromClientId: String(a.fromClientId),
    targetClientId: String(a.targetClientId),
    createdAtMs: typeof a.createdAtMs === "number" ? a.createdAtMs : Date.now(),
  }))

const doctorSaves: DoctorSaveAction[] = actions
  .filter((a: any) => a?.kind === "DOCTOR_SAVE")
  .map((a: any) => ({
    kind: "DOCTOR_SAVE",
    roomId: cleanRoomId,
    fromClientId: String(a.fromClientId),
    targetClientId: String(a.targetClientId),
    createdAtMs: typeof a.createdAtMs === "number" ? a.createdAtMs : Date.now(),
  }))

  // Enforce + spend doctor self-save at resolution time (final action only)
  const finalDoctorSaves: DoctorSaveAction[] = doctorSaves.filter((a) => {
    if (a.targetClientId !== a.fromClientId) return true

    const used = getDoctorSelfSaveUsed(cleanRoomId, room.gameNumber, a.fromClientId)
    if (used) {
      // Self-save already used this game; ignore this save for resolution
      return false
    }

    // Spend it now (final action set is known)
    markDoctorSelfSaveUsed(cleanRoomId, room.gameNumber, a.fromClientId)
    return true
  })

    const res = resolveNightPhase(
      cleanRoomId,
      room.gameNumber,
      room.players,
      mafiaVotes,
      finalDoctorSaves
    )

    // Apply kill (if any)
    if (res.killedClientId) {
      const target = room.players.find((p) => p.clientId === res.killedClientId)
      if (target && target.isSpectator !== true) {
        target.alive = false
      }
    }

    // Clear NIGHT actions at the phase boundary
    clearRoleActions(cleanRoomId, "NIGHT")

    // OPTIONAL: You can log debug server-side without affecting clients
    // console.log("DEBUG: night resolution", { roomId: cleanRoomId, res })
  }

  const startPhase = (roomId: string, phase: Phase) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return

    room.phase = phase
    const sec = getPhaseDurationSec(room, phase)
    room.phaseEndTime = sec > 0 ? Date.now() + sec * 1000 : null

    emitRoomState(cleanRoomId)

    // IMPORTANT (timer safety):
    // Only allow ONE scheduled transition at a time.
    // This prevents "ghost transitions" when phases are changed manually or game ends.
    clearPhaseTimeout(room)

    // Schedule the next transition (server authoritative)
    if (room.phaseEndTime) {
      room.phaseTimeoutId = setTimeout(() => {
        const r = rooms[cleanRoomId]
        if (!r) return
        if (!r.gameStarted) return

        // If phase changed manually or game ended, do nothing
        if (r.phase !== phase) return

        // If NIGHT just ended, resolve NIGHT actions BEFORE moving on
        if (phase === "NIGHT") {
          applyNightResolution(r, cleanRoomId)
          emitRoomState(cleanRoomId)
        }

        startPhase(cleanRoomId, nextPhase(phase))
      }, sec * 1000)
    }
  }


    /* ------------------------------------------------------
          Helper: removes clientId from all rooms
  ------------------------------------------------------ */

  const removeFromAllRooms = (clientId: string, skipRoomId?: string) => {
    const skip = skipRoomId ? normalizeRoomId(skipRoomId) : undefined
    const cleanClientId = (clientId || "").trim()
    if (!cleanClientId) return

    for (const roomId of Object.keys(rooms)) {
      if (skip && roomId === skip) continue

      const room = rooms[roomId]
      if (!room) continue

      const before = room.players.length

      // remove any player with same clientId
      room.players = room.players.filter((p) => p.clientId !== cleanClientId)

      // If host leaves, assign new host
      if (room.hostId === cleanClientId) {
        room.hostId = room.players[0]?.clientId ?? ""
      }

      if (before !== room.players.length) {
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

      // room.players = removePlayer(room.players, socket.id)

      const leavingClientId = String(socket.data.clientId || "")

      // IMPORTANT (reconnect-safe):
      // Do NOT transfer host ownership on disconnecting.
      // Refresh/reconnect should not cause host changes.
      // Host is only transferred on explicit leave or room cleanup.

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
    playerName: string,
    clientId: string
  ) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const cleanName = normalizeName(playerName)
    if (!cleanRoomId || !cleanName) return

    rooms[cleanRoomId] = {
      hostId: clientId, // Host is stable identity
      players: [],
      settings: defaultSettings(),

      gameStarted: false,
      gameNumber: 0,
      phase: "LOBBY",
      phaseEndTime: null,
      phaseTimeoutId: null,
    }

    removeFromAllRooms(clientId, cleanRoomId)

    socket.join(cleanRoomId)

    rooms[cleanRoomId].players.push(
      mergePlayerState(undefined, socket.id, clientId, cleanName)
    )

    emitRoomState(cleanRoomId)
  }

  /* ------------------------------------------------------
                Host Settings Update Live
  ------------------------------------------------------ */

const updateRoomSettings = (
  socket: Socket,
  roomId: string,
  settings: Partial<GameSettings>
) => {
  const cleanRoomId = normalizeRoomId(roomId)
  const room = rooms[cleanRoomId]
  if (!room) return

  // Host-only
  if (room.hostId !== socket.data.clientId) {
    socket.emit("settingsRefused", { reason: "Only the host can update settings." })
    return
  }

  const playerCount = room.players.length
  const bounds = getRoleBounds(playerCount)

  console.log("DEBUG: updateRoomSettings incoming", { cleanRoomId, playerCount, settings })
  console.log("DEBUG: bounds", bounds)
  console.log("DEBUG: current roleCount", room.settings.roleCount)

  const next: GameSettings = {
    timers: normalizeTimers(settings.timers, room.settings.timers),
    roleCount: normalizeRoleCount(
      settings.roleCount,
      room.settings.roleCount,
      playerCount,
      bounds
    ),
  }

  console.log("DEBUG: next roleCount", next.roleCount)

  room.settings = next
  emitRoomState(cleanRoomId)
}


  /* ------------------------------------------------------
                        Join Room
  ------------------------------------------------------ */

  const joinRoomLocal = (
    socket: Socket,
    roomId: string,
    playerName: string,
    clientId: string
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

    const shouldSpectate = room.gameStarted === true

    removeFromAllRooms(clientId, cleanRoomId)

    socket.join(cleanRoomId)

    const existing = room.players.find((p) => p.clientId === clientId) ?? 
                      room.players.find((p) => p.clientId === clientId)
    
    const merged = mergePlayerState(existing, socket.id, clientId, cleanName)

    // makes it so that Reconnects keep their prior spectator status
    const nextPlayer = existing ?
    merged : { ...merged, isSpectator: shouldSpectate }

    room.players = room.players.filter((p) => p.clientId !== clientId && p.id !== clientId) // remove old entry if exists
    room.players.push(nextPlayer)

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

    room.players = room.players.filter((p) => p.clientId !== socket.data.clientId)

    if (room.hostId === socket.data.clientId) {
      room.hostId = room.players[0]?.clientId ?? ""
    }

    if (room.players.length === 0) {
      delete rooms[cleanRoomId]
      io.to(cleanRoomId).emit("roomClosed", { roomId: cleanRoomId })
      return
    }

    emitRoomState(cleanRoomId)
  }

/* ------------------------------------------------------
        Helper: role assignment (server-only)
    - Assign roles ONLY at the start of a new game
    - Uses room.settings.roleCount
    - Spectators are excluded (no role)
    - Roles are stored on player.role but NEVER broadcast publicly
      (emitRoomState masks role during gameStarted)
------------------------------------------------------ */

  const shuffleInPlace = <T,>(arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))

      // TS-safe swap (i/j are always in range)
      const tmp = arr[i]!
      arr[i] = arr[j]!
      arr[j] = tmp
    }
    return arr
  }


  const assignRolesForNewGame = (room: Room) => {
    const activePlayers = room.players.filter((p) => p.isSpectator !== true)

    // Safety: if no active players, nothing to do
    if (activePlayers.length === 0) return

    const rc = room.settings.roleCount

    // Build the role pool (mafia/doctor/detective/sheriff), then fill rest as civilian
    const pool: PlayerRole[] = []

    for (let i = 0; i < rc.mafia; i++) pool.push("MAFIA")
    for (let i = 0; i < rc.doctor; i++) pool.push("DOCTOR")
    for (let i = 0; i < rc.detective; i++) pool.push("DETECTIVE")
    for (let i = 0; i < rc.sheriff; i++) pool.push("SHERIFF")

    // If pool is larger than player count (should be prevented by UI + normalizeRoleCount),
    // trim safely anyway so we never crash or assign out-of-bounds.
    const trimmedPool = pool.slice(0, activePlayers.length)

    shuffleInPlace(activePlayers)
    shuffleInPlace(trimmedPool)

    // Assign pool roles first, remainder becomes CIVILIAN
    let idx = 0
    for (const p of activePlayers) {
      const role = trimmedPool[idx] ?? "CIVILIAN"
      p.role = role
      idx++
    }


    // Spectators get no meaningful role (kept as CIVILIAN in state)
    // but they will NEVER receive private role emits.
    for (const p of room.players) {
      if (p.isSpectator === true) {
        p.role = "CIVILIAN"
      }
    }
  }

  /* ------------------------------------------------------
            Helper: private role emit (anti-spoiler)
    - Sends role ONLY to the player’s current socket
    - Never broadcasts to the room
  ------------------------------------------------------ */

  const emitPrivateRoleToPlayer = (
    roomId: string,
    gameNumber: number,
    player: Player
  ) => {
    if (player.isSpectator === true) return
    const s = io.sockets.sockets.get(player.id)
    if (!s) return

    s.emit("yourRole", {
      roomId,
      gameNumber,
      role: player.role,
    })
  }

  const emitPrivateRolesToRoom = (roomId: string) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return
    if (!room.gameStarted) return

    for (const p of room.players) {
      emitPrivateRoleToPlayer(cleanRoomId, room.gameNumber, p)
    }
  }


  /* ------------------------------------------------------
              Start Game (host-only)
      - Normal start: requires all players READY
      - Force start: host can start anytime
      - Does NOT assign roles (handled later)
  ------------------------------------------------------ */

  const startGameLocal = (
    socket: Socket,
    roomId: string,
    opts: { force: boolean }
  ) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return

    // Host-only
    if (room.hostId !== socket.data.clientId) {
      socket.emit("startRefused", { reason: "Only the host can start the game." })
      return
    }

    if (room.gameStarted) {
      socket.emit("startRefused", { reason: "Game already started." })
      return
    }

    if (!opts.force) {
      const allReady = room.players.length > 0 && room.players.every((p) => p.status === "READY")
      if (!allReady) {
        socket.emit("startRefused", { reason: "All players must be READY to start." })
        return
      }
    }

      // Convert spectators into active players ONLY at new game boundary.
    room.players = room.players.map((p) =>
      p.isSpectator
        ? {
            ...p,
            isSpectator: false,
            alive: true,
            status: "NOT READY",
            voteCount: 0,
            // Do NOT assign role here; role assignment is handled later.
            role: "CIVILIAN",
          }
        : {
            ...p,
            alive: true,
            status: "NOT READY",
            voteCount: 0,
            // Do NOT assign role here; role assignment is handled later.
            role: "CIVILIAN",
          }
    )


    room.gameStarted = true
    room.gameNumber += 1

    // Clear any buffered actions from previous games (safety)
    clearRoleActions(cleanRoomId, "NIGHT")
    clearRoleActions(cleanRoomId, "DAY")
    clearRoleActions(cleanRoomId, "VOTING")

    // Assign roles now that the game is starting
    assignRolesForNewGame(room)

    startPhase(cleanRoomId, "DAY")

    emitPrivateRolesToRoom(cleanRoomId)

    // Broadcast state + a simple event (no role assignment here)
    emitRoomState(cleanRoomId)
    io.to(cleanRoomId).emit("gameStarted", {
      roomId: cleanRoomId,
      gameNumber: room.gameNumber,
    })
  }

  /* ------------------------------------------------------
                      Kick Player (host-only)
  ------------------------------------------------------ */

  const kickPlayerLocal = (socket: Socket, roomId: string, targetClientId: string) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return

    // Host-only
    if (room.hostId !== socket.data.clientId) {
      socket.emit("kickRefused", { reason: "Only the host can kick players." })
      return
    }

    const cleanTarget = (targetClientId || "").trim()
    if (!cleanTarget) return

    // Host cannot kick themselves
    if (cleanTarget === room.hostId) {
      socket.emit("kickRefused", { reason: "Host cannot kick themselves." })
      return
    }

    const targetPlayer = room.players.find((p) => p.clientId === cleanTarget)
    if (!targetPlayer) return

    // Remove from server state
    room.players = room.players.filter((p) => p.clientId !== cleanTarget)

    // If room empty, close; otherwise emit state
    if (room.players.length === 0) {
      delete rooms[cleanRoomId]
      io.to(cleanRoomId).emit("roomClosed", { roomId: cleanRoomId })
      return
    }

    emitRoomState(cleanRoomId)

    // Try to notify + remove the target socket from the room
    const targetSocketId = targetPlayer.id // current socket id
    const s = io.sockets.sockets.get(targetSocketId)
    if (s) {
      s.leave(cleanRoomId)
      s.emit("kicked", { roomId: cleanRoomId, reason: "You were kicked by the host." })
    }
  }

/* ------------------------------------------------------
                  Reconnect handling
      - If client reconnects, restore them to their room
      - Prevent duplicates by matching clientId
------------------------------------------------------ */

  const handleReconnect = (socket: Socket, clientId: string) => {
  const cleanClientId = (clientId || "").trim()
  if (!cleanClientId) return

  console.log("DEBUG: handleReconnect called", { clientId: cleanClientId })


  for (const roomId of Object.keys(rooms)) {
    const room = rooms[roomId]
    if (!room) continue

    const idx = room.players.findIndex((p) => p.clientId === cleanClientId)
    if (idx === -1) continue

    // Grab the existing player first (prevents "possibly undefined" + keeps required fields)
    const existingPlayer = room.players[idx]
    if (!existingPlayer) continue

    // Update socket id
    room.players[idx] = { ...existingPlayer, id: socket.id }

    // Re-join socket.io room
    socket.join(roomId)

        console.log("DEBUG: reattached client to room", {
      roomId,
      clientId: cleanClientId,
      socketId: socket.id,
    })

    // Notify client UI that it was restored
    socket.emit("reconnected", {
      roomId,
      playerName: existingPlayer.name,
    })

    // Re-send private role on reconnect (anti-spoiler, reconnect-safe)
    if (room.gameStarted && existingPlayer.isSpectator !== true) {
      socket.emit("yourRole", {
        roomId,
        gameNumber: room.gameNumber,
        role: existingPlayer.role,
      })
    }

    // Broadcast updated room state
    emitRoomState(roomId)
    return
  }

  console.log("DEBUG: no prior room found for client", { clientId: cleanClientId })
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

/* ------------------------------------------------------
      Role Action Submission (server-authoritative)
    - Validates action against:
      - current room phase
      - player role
      - alive/spectator rules
      - target validity
      - special rules (doctor self-save once/game, mafia can't target mafia)
    - Records into the in-memory buffer (roles/index.ts)
    - Does NOT mutate room state here (resolution happens at phase boundary)
------------------------------------------------------ */

  const submitRoleActionLocal = (
    socket: Socket,
    roomId: string,
    payload: { kind: string; targetClientId: string }
  ) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) {
      socket.emit("actionRefused", { reason: "Room does not exist." })
      return
    }

    const fromClientId = String(socket.data.clientId || "").trim()
    if (!fromClientId) {
      socket.emit("actionRefused", { reason: "Missing client identity." })
      return
    }

    const actor = room.players.find((p) => p.clientId === fromClientId)
    if (!actor) {
      socket.emit("actionRefused", { reason: "Player not found in room." })
      return
    }

    const kind = String(payload.kind || "").trim()
    const targetClientId = String(payload.targetClientId || "").trim()

    if (!kind) {
      socket.emit("actionRefused", { reason: "Missing action kind." })
      return
    }

    if (!targetClientId) {
      socket.emit("actionRefused", { reason: "Missing targetClientId." })
      return
    }

    // Must be in-game for all actions except (optionally) CIVILIAN_VOTE;
    // we still enforce phase rules below.
    if (!room.gameStarted) {
      socket.emit("actionRefused", { reason: "Game has not started." })
      return
    }

    // Actor eligibility
    if (actor.isSpectator === true) {
      socket.emit("actionRefused", { reason: "Spectators cannot perform actions." })
      return
    }
    if (actor.alive !== true) {
      socket.emit("actionRefused", { reason: "Dead players cannot perform actions." })
      return
    }

    // Target validity
    const target = room.players.find((p) => p.clientId === targetClientId)
    if (!target) {
      socket.emit("actionRefused", { reason: "Target player not found." })
      return
    }
    if (target.isSpectator === true) {
      socket.emit("actionRefused", { reason: "Spectators cannot be targeted." })
      return
    }
    if (target.alive !== true) {
      socket.emit("actionRefused", { reason: "Target must be alive." })
      return
    }

    // Phase rules (server authoritative)
    const phase = room.phase

    const refuse = (reason: string) => {
      socket.emit("actionRefused", { kind, reason })
    }

    // Role gating + phase gating
    if (kind === "MAFIA_KILL_VOTE") {
      if (phase !== "NIGHT") return refuse("Mafia can only vote to kill during NIGHT.")
      if (actor.role !== "MAFIA") return refuse("Only Mafia can submit mafia kill votes.")
      if (target.role === "MAFIA") return refuse("Mafia cannot target fellow mafia.")
    } else if (kind === "DOCTOR_SAVE") {
      if (phase !== "NIGHT") return refuse("Doctor can only save during NIGHT.")
      if (actor.role !== "DOCTOR") return refuse("Only Doctor can submit doctor saves.")

      // Doctor self-save only once per game
      if (targetClientId === fromClientId) {
        const used = getDoctorSelfSaveUsed(cleanRoomId, room.gameNumber, fromClientId)
        if (used) return refuse("Doctor self-save is only allowed once per game.")
        // IMPORTANT:
        // Do NOT mark self-save as used here; doctor may change their mind before NIGHT ends.
        // We mark usage at resolution time based on the final NIGHT action set.
      }


    } else if (kind === "DETECTIVE_CHECK") {
      if (phase !== "NIGHT") return refuse("Detective can only check during NIGHT.")
      if (actor.role !== "DETECTIVE") return refuse("Only Detective can submit checks.")
    } else if (kind === "SHERIFF_SHOOT") {
      if (phase === "NIGHT") return refuse("Sheriff cannot shoot during NIGHT.")
      if (actor.role !== "SHERIFF") return refuse("Only Sheriff can shoot.")
    } else if (kind === "CIVILIAN_VOTE") {
      if (phase !== "VOTING") return refuse("Votes can only be submitted during VOTING.")
      // We allow any alive, non-spectator player to submit this (UI parity)
    } else {
      return refuse("Unknown action kind.")
    }

    // Record action into in-memory buffer (phase bucket is derived by kind)
    recordRoleAction({
      kind: kind as any,
      roomId: cleanRoomId,
      fromClientId,
      targetClientId,
      createdAtMs: Date.now(),
    })

    socket.emit("actionAccepted", { kind, targetClientId })
  }

    /* ------------------------------------------------------
        Helper: get my recorded actions (private)
    - Used by UI / reconnect flows to restore a player’s current selection
    - Reads from the in-memory action buffer and emits ONLY to requesting socket
    - Uses current phase to pick the correct bucket:
      NIGHT -> NIGHT
      VOTING -> VOTING
      everything else -> DAY (covers DAY/DISCUSSION/PUBDISCUSSION for sheriff)
  ------------------------------------------------------ */

  const requestMyActionsLocal = (socket: Socket, roomId: string) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) {
      socket.emit("myActions", { roomId: cleanRoomId, actions: [] })
      return
    }

    const fromClientId = String(socket.data.clientId || "").trim()
    if (!fromClientId) {
      socket.emit("myActions", { roomId: cleanRoomId, actions: [] })
      return
    }

    // Map current room phase -> action bucket
    const bucket =
      room.phase === "NIGHT" ? "NIGHT" : room.phase === "VOTING" ? "VOTING" : "DAY"

    const mine = getRoleActions(cleanRoomId, bucket).filter(
      (a: any) => a?.fromClientId === fromClientId
    )

    // Emit only the minimal, safe info needed by client UI
    socket.emit("myActions", {
      roomId: cleanRoomId,
      gameNumber: room.gameNumber,
      phase: room.phase,
      bucket,
      actions: mine.map((a: any) => ({
        kind: a.kind,
        targetClientId: a.targetClientId,
        createdAtMs: a.createdAtMs,
      })),
    })
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
    handleReconnect,
    startGameLocal,
    kickPlayerLocal,
    submitRoleActionLocal,
    requestMyActionsLocal,
  }
}
