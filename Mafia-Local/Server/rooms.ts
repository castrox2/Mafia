import type { Server as SocketIOServer } from "socket.io"
import type { Socket } from "socket.io"
import type { MafiaKillVoteAction, DoctorSaveAction, DetectiveCheckAction, SheriffShootAction } from "./roles/types.js"
import { SKIP_TARGET_CLIENT_ID } from "./roles/types.js"
import type { Player, PlayerRole, PlayerStatus } from "./players.js"
import { resolveNightPhase } from "./roles/night.js"
import { resolveDetectiveChecks } from "./roles/detective.js"
import { resolveSheriffShots } from "./roles/sheriff.js"
import { markSheriffUsed } from "./roles/index.js"

import {
  mergePlayerState,
  setAlive as setAliveList,
  setRole as setRoleList,
  setStatus as setStatusList,
} from "./players.js"

import {
  getRoleActions,
  clearRoleActions,
  recordRoleAction,
  getDoctorSelfSaveUsed,
  getSheriffUsed,
  clearRoomRoleMemory,
} from "./roles/index.js"

// UI animation lead time: emit "phaseEnding" shortly before the phase actually switches.
// This does NOT change game logic timing; it's just a client-friendly hint.
const PHASE_ENDING_LEAD_MS = 500

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
  hostParticipates: boolean
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
  phaseEndingTimeoutId?: NodeJS.Timeout | null
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
        doctor: { min: 0, max: 0 },
        detective: { min: 0, max: 0 },
        sheriff: { min: 0, max: 0 },
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
        mafia: { min: 1, max: 3 },
        doctor: { min: 0, max: 1 },
        detective: { min: 0, max: 1 },
        sheriff: { min: 0, max: 1 },
      }
    }

    if (playerCount <= 12) {
      return {
        mafia: { min: 1, max: 4 },
        doctor: { min: 0, max: 1 },
        detective: { min: 0, max: 1 },
        sheriff: { min: 0, max: 1 },
      }
    }

    if (playerCount <= 14) {
      return {
        mafia: { min: 3, max: 5 },
        doctor: { min: 0, max: 1 },
        detective: { min: 0, max: 1 },
        sheriff: { min: 0, max: 1 },
      }
    }

    // playerCount >= 15
    return {
      mafia: { min: 3, max: 6 },
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

  const getActivePlayers = (room: Room) =>
    room.players.filter((p) => p.isSpectator !== true)

  const getActivePlayerCount = (room: Room) =>
    getActivePlayers(room).length

  const emitRoomState = (roomId: string) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return

    reconcileRoomGameFlags(room)
    room.players = dedupePlayersByClientId(room.players)

    io.to(cleanRoomId).emit("roomState", {
      roomId: cleanRoomId,
      hostId: room.hostId,
      hostParticipates: room.hostParticipates,

      // IMPORTANT (anti-spoiler):
      // Never broadcast real roles in roomState during a running game.
      // Roles should be sent privately to each player later (separate event).
      players: room.players.map((p) => ({
        ...p,
        role: room.gameStarted ? "CIVILIAN" : p.role,
      })),

      settings: room.settings,
      roleBounds: getRoleBounds(getActivePlayerCount(room)),
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

  const clearPhaseEndingTimeout = (room: Room) => {
    if (room.phaseEndingTimeoutId) {
      clearTimeout(room.phaseEndingTimeoutId)
      room.phaseEndingTimeoutId = null
    }
  }

/* ------------------------------------------------------
        Helper: clear phase scheduling metadata
  - Cancels all phase timers
  - Clears active phase end timestamp
------------------------------------------------------ */

  const clearPhaseScheduling = (room: Room) => {
    clearPhaseTimeout(room)
    clearPhaseEndingTimeout(room)
    room.phaseEndTime = null
  }

/* ------------------------------------------------------
        Helper: clear gameplay action buffers
  - NIGHT / DAY / VOTING are the only role-action buckets
------------------------------------------------------ */

  const clearGameplayRoleActions = (cleanRoomId: string) => {
    clearRoleActions(cleanRoomId, "NIGHT")
    clearRoleActions(cleanRoomId, "DAY")
    clearRoleActions(cleanRoomId, "VOTING")
  }

/* ------------------------------------------------------
        Helper: reset players for a fresh game
  - Revives everyone and clears per-game state
  - Promotes spectators back into active players
------------------------------------------------------ */

  const resetPlayersForNewGame = (room: Room) => {
    room.players = room.players.map((p) => ({
      ...p,
      isSpectator: p.clientId === room.hostId ? !room.hostParticipates : false,
      alive: true,
      status:
        p.clientId === room.hostId && room.hostParticipates === false
          ? "CONNECTED"
          : "NOT READY",
      voteCount: 0,
      role: "CIVILIAN",
    }))
  }

/* ------------------------------------------------------
        Helper: normalize role counts for player count
  - Re-clamps roles to current room size bounds
------------------------------------------------------ */

  const normalizeRoleCountsForRoom = (room: Room): number => {
    const playerCount = getActivePlayerCount(room)
    const bounds = getRoleBounds(playerCount)
    room.settings = {
      ...room.settings,
      roleCount: normalizeRoleCount(
        room.settings.roleCount,
        room.settings.roleCount,
        playerCount,
        bounds
      ),
    }

    return playerCount
  }

/* ------------------------------------------------------
        Helper: repair impossible game state combos
  - GAMEOVER must not be paired with gameStarted=true
  - Keeps old/stale room states from blocking restarts
------------------------------------------------------ */

  const reconcileRoomGameFlags = (room: Room) => {
    if (room.phase !== "GAMEOVER") return
    if (!room.gameStarted) return

    clearPhaseScheduling(room)
    room.gameStarted = false
  }

type Winner = "MAFIA" | "CIVILIANS"

  const getWinnerFromAliveState = (room: Room): Winner | null => {
    const aliveActivePlayers = room.players.filter(
      (p) => p.isSpectator !== true && p.alive === true
    )

    const aliveMafiaCount = aliveActivePlayers.filter((p) => p.role === "MAFIA").length
    const aliveNonMafiaCount = aliveActivePlayers.length - aliveMafiaCount

    // If no mafia remain, civilians win.
    if (aliveMafiaCount === 0) return "CIVILIANS"

    // Mafia win at parity/majority against non-mafia alive players.
    if (aliveMafiaCount >= aliveNonMafiaCount) return "MAFIA"

    return null
  }

  const maybeEndGameFromAliveState = (room: Room, cleanRoomId: string): boolean => {
    if (!room.gameStarted) return false

    const winner = getWinnerFromAliveState(room)
    if (!winner) return false

    clearPhaseScheduling(room)

    room.phase = "GAMEOVER"
    room.gameStarted = false

    // Safety: no stale phase actions should survive into the next game.
    clearGameplayRoleActions(cleanRoomId)

    io.to(cleanRoomId).emit("gameOver", {
      roomId: cleanRoomId,
      gameNumber: room.gameNumber,
      winner,
    })

    emitRoomState(cleanRoomId)
    return true
  }

/* ------------------------------------------------------
              Helper: apply night resolution
  - Server-authoritative: applies the night kill to room state
  - Anti-spoiler: roomState already masks roles during gameStarted
  - Spectators cannot be targeted (resolver already filters)
------------------------------------------------------ */

  const applyNightResolution = (room: Room, cleanRoomId: string) => {
    // Pull buffered NIGHT actions
    const actions = getRoleActions(cleanRoomId, "NIGHT")

    // Adapt to the minimal shape resolveNightPhase expects:
    // - fromClientId
    // - targetClientId
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

    const detectiveChecks: DetectiveCheckAction[] = actions
    .filter((a: any) => a?.kind === "DETECTIVE_CHECK")
    .map((a: any) => ({
      kind: "DETECTIVE_CHECK",
      roomId: cleanRoomId,
      fromClientId: String(a.fromClientId),
      targetClientId: String(a.targetClientId),
      createdAtMs: typeof a.createdAtMs === "number" ? a.createdAtMs : Date.now(),
    }))


    const res = resolveNightPhase(
      cleanRoomId,
      room.gameNumber,
      room.players,
      mafiaVotes,
      doctorSaves
    )

    // Apply kill (if any)
    if (res.killedClientId) {
      const target = room.players.find((p) => p.clientId === res.killedClientId)
      if (target && target.isSpectator !== true) {
        target.alive = false
      }
    }

        // Public night summary (anti-spoiler)
    io.to(cleanRoomId).emit("nightSummary", {
      roomId: cleanRoomId,
      gameNumber: room.gameNumber,
      someoneDied: Boolean(res.killedClientId),
    })

    // Detective: resolve privately (anti-spoiler)
    // - We do NOT broadcast results.
    // - Each detective gets their own "DETECTIVE_RESULT".
    const detectiveRes = resolveDetectiveChecks(room.players, detectiveChecks)

    for (const msg of detectiveRes.privateMessages) {
      // msg.toClientId is the detective's clientId
      const detective = room.players.find((p) => p.clientId === msg.toClientId)
      if (!detective || detective.isSpectator === true) continue

      const s = io.sockets.sockets.get(detective.id)
      if (!s) continue

      // Emit only to that detective
      s.emit("privateMessage", {
        roomId: cleanRoomId,
        gameNumber: room.gameNumber,
        ...msg,
      })
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
    if (maybeEndGameFromAliveState(room, cleanRoomId)) return

    room.phase = phase
    const sec = getPhaseDurationSec(room, phase)
    room.phaseEndTime = sec > 0 ? Date.now() + sec * 1000 : null

    emitRoomState(cleanRoomId)

    // UI-friendly phase transition hook (animations/screens can key off this)
    io.to(cleanRoomId).emit("phaseStarted", {
      roomId: cleanRoomId,
      gameNumber: room.gameNumber,
      phase: room.phase,
      phaseEndTime: room.phaseEndTime,
    })


    // IMPORTANT (timer safety):
    // Only allow ONE scheduled transition at a time.
    // This prevents "ghost transitions" when phases are changed manually or game ends.
    clearPhaseTimeout(room)

    // Clear any previous "phaseEnding" timer too (avoid ghost events)
    clearPhaseEndingTimeout(room)


    // Schedule the next transition (server authoritative)
    if (room.phaseEndTime) {

            // Emit a UI hint slightly before the phase ends so clients can run exit animations.
      // For very short phases, this may emit immediately.
      const leadMs = Math.max(0, Math.min(PHASE_ENDING_LEAD_MS, sec * 1000))
      const endingDelayMs = Math.max(0, sec * 1000 - leadMs)

      room.phaseEndingTimeoutId = setTimeout(() => {
        const r2 = rooms[cleanRoomId]
        if (!r2) return
        if (!r2.gameStarted) return
        if (r2.phase !== phase) return

        io.to(cleanRoomId).emit("phaseEnding", {
          roomId: cleanRoomId,
          gameNumber: r2.gameNumber,
          fromPhase: phase,
          toPhase: nextPhase(phase),
          leadMs,
        })
      }, endingDelayMs)

      room.phaseTimeoutId = setTimeout(() => {
        const r = rooms[cleanRoomId]
        if (!r) return
        if (!r.gameStarted) return

        // If phase changed manually or game ended, do nothing
        if (r.phase !== phase) return

        // If NIGHT just ended, resolve NIGHT actions BEFORE moving on
        if (phase === "NIGHT") {
          applyNightResolution(r, cleanRoomId)
          if (maybeEndGameFromAliveState(r, cleanRoomId)) return
          emitRoomState(cleanRoomId)
        }

        // If VOTING just ended, resolve votes BEFORE moving on
        if (phase === "VOTING") {
          finalizeVotingPhase(r, cleanRoomId)
          return
        }

        if (maybeEndGameFromAliveState(r, cleanRoomId)) return
        startPhase(cleanRoomId, nextPhase(phase))
      }, sec * 1000)
    }
  }

  /* ------------------------------------------------------
              Helper: apply voting resolution
  - Server-authoritative: applies vote elimination to room state
  - Uses buffered CIVILIAN_VOTE actions from VOTING phase
  - Spectators cannot vote or be targeted (validated here defensively)
  - Tie/no votes => no elimination
------------------------------------------------------ */

  const applyVotingResolution = (room: Room, cleanRoomId: string) => {
    const actions = getRoleActions(cleanRoomId, "VOTING")

    // Build a map of targetClientId -> vote count
    const tally = new Map<string, number>()

    for (const a of actions) {
      if ((a as any)?.kind !== "CIVILIAN_VOTE") continue

      const fromClientId = String((a as any).fromClientId || "").trim()
      const targetClientId = String((a as any).targetClientId || "").trim()
      if (!fromClientId || !targetClientId) continue

      // Explicit skip vote: accepted action, but does not add tally.
      if (targetClientId === SKIP_TARGET_CLIENT_ID) continue

      const voter = room.players.find((p) => p.clientId === fromClientId)
      const target = room.players.find((p) => p.clientId === targetClientId)

      // Defensive eligibility checks (server truth)
      if (!voter || voter.isSpectator === true || voter.alive !== true) continue
      if (!target || target.isSpectator === true || target.alive !== true) continue

      tally.set(targetClientId, (tally.get(targetClientId) ?? 0) + 1)
    }

    // Decide winner (if any)
    let topCount = 0
    let topTargets: string[] = []

    for (const [targetClientId, count] of tally.entries()) {
      if (count > topCount) {
        topCount = count
        topTargets = [targetClientId]
      } else if (count === topCount && count > 0) {
        topTargets.push(targetClientId)
      }
    }

    let eliminatedClientId: string | null = null

    // No votes OR tie => no elimination
    if (topCount > 0 && topTargets.length === 1) {
      eliminatedClientId = topTargets[0] ?? null
    }

    if (eliminatedClientId) {
      const target = room.players.find((p) => p.clientId === eliminatedClientId)
      if (target && target.isSpectator !== true) {
        target.alive = false
      }
    }

    // Clear VOTING actions at the phase boundary
    clearRoleActions(cleanRoomId, "VOTING")

    // Public vote summary (anti-spoiler)
    io.to(cleanRoomId).emit("voteSummary", {
      roomId: cleanRoomId,
      gameNumber: room.gameNumber,
      someoneDied: Boolean(eliminatedClientId),
    })
  }

  /* ------------------------------------------------------
            Helper: check voting completion
  - All alive, non-spectator players must submit one CIVILIAN_VOTE
  - Skip votes count as valid submitted votes
------------------------------------------------------ */

  const allEligibleVotersSubmitted = (room: Room, cleanRoomId: string): boolean => {
    if (room.phase !== "VOTING") return false

    const eligibleVoterIds = room.players
      .filter((p) => p.isSpectator !== true && p.alive === true)
      .map((p) => p.clientId)

    if (eligibleVoterIds.length === 0) return false

    const votedClientIds = new Set(
      getRoleActions(cleanRoomId, "VOTING")
        .filter((a: any) => a?.kind === "CIVILIAN_VOTE")
        .map((a: any) => String(a.fromClientId || "").trim())
        .filter((id: string) => id.length > 0)
    )

    return eligibleVoterIds.every((clientId) => votedClientIds.has(clientId))
  }

  /* ------------------------------------------------------
            Helper: resolve + advance from voting
  - Resolves VOTING outcomes immediately
  - Clears remaining phase timer and moves to NIGHT
------------------------------------------------------ */

  const finalizeVotingPhase = (room: Room, cleanRoomId: string) => {
    if (!room.gameStarted) return
    if (room.phase !== "VOTING") return

    clearPhaseTimeout(room)
    clearPhaseEndingTimeout(room)

    applyVotingResolution(room, cleanRoomId)

    // Sheriff resolves at end of VOTING (right before NIGHT)
    applySheriffResolution(room, cleanRoomId)
    if (maybeEndGameFromAliveState(room, cleanRoomId)) return

    emitRoomState(cleanRoomId)
    if (maybeEndGameFromAliveState(room, cleanRoomId)) return
    startPhase(cleanRoomId, nextPhase("VOTING"))
  }

  /* ------------------------------------------------------
              Helper: apply sheriff resolution
  - Resolves SHERIFF_SHOOT buffered under DAY bucket
  - Applied at end of VOTING (right before NIGHT)
  - Anti-spoiler: emits only the allowed public announcement
------------------------------------------------------ */

  const applySheriffResolution = (room: Room, cleanRoomId: string) => {
    const actions = getRoleActions(cleanRoomId, "DAY")

    const shots: SheriffShootAction[] = actions
      .filter((a: any) => a?.kind === "SHERIFF_SHOOT")
      .map((a: any) => ({
        kind: "SHERIFF_SHOOT",
        roomId: cleanRoomId,
        fromClientId: String(a.fromClientId),
        targetClientId: String(a.targetClientId),
        createdAtMs: typeof a.createdAtMs === "number" ? a.createdAtMs : Date.now(),
      }))

    if (shots.length === 0) return

    // Build "used" tracker from per-game memory
    const usedMap: Record<string, boolean> = {}
    for (const p of room.players) {
      if (p.role !== "SHERIFF") continue
      usedMap[p.clientId] = getSheriffUsed(cleanRoomId, room.gameNumber, p.clientId)
    }

    const res = resolveSheriffShots(room.players, shots, usedMap)

    // Persist any consumed sheriff shots (one-time per game)
    for (const sheriffId of res.usedByClientIds) {
      if (!getSheriffUsed(cleanRoomId, room.gameNumber, sheriffId)) {
        markSheriffUsed(cleanRoomId, room.gameNumber, sheriffId)
      }
    }

    // Apply kill (if any)
    if (res.killedClientId) {
      const target = room.players.find((p) => p.clientId === res.killedClientId)
      if (target && target.isSpectator !== true) {
        target.alive = false
      }
    }

    // Clear DAY bucket actions at boundary (this includes sheriff shots)
    clearRoleActions(cleanRoomId, "DAY")

    // Public announcement(s)
    if (res.publicAnnouncements.length > 0) {
      io.to(cleanRoomId).emit("publicAnnouncements", {
        roomId: cleanRoomId,
        gameNumber: room.gameNumber,
        announcements: res.publicAnnouncements,
      })
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
        room.hostParticipates = true
      }

      if (before !== room.players.length) {
        if (room.players.length === 0) {
          clearRoomRoleMemory(roomId)
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

      // IMPORTANT (reconnect-safe):
      // Do NOT transfer host ownership on disconnecting.
      // Refresh/reconnect should not cause host changes.
      // Host is only transferred on explicit leave or room cleanup.

      if (room.players.length === 0) {
        clearRoomRoleMemory(roomId)
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
      hostParticipates: true,
      players: [],
      settings: defaultSettings(),

      gameStarted: false,
      gameNumber: 0,
      phase: "LOBBY",
      phaseEndTime: null,
      phaseTimeoutId: null,
      phaseEndingTimeoutId: null,
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

  const playerCount = getActivePlayerCount(room)
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

    const isHostClient = clientId === room.hostId
    const shouldSpectate =
      room.gameStarted === true || (isHostClient && room.hostParticipates === false)

    removeFromAllRooms(clientId, cleanRoomId)

    socket.join(cleanRoomId)

    const existing = room.players.find((p) => p.clientId === clientId)
    
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
      room.hostParticipates = true
    }

    if (room.players.length === 0) {
      clearRoomRoleMemory(cleanRoomId)
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

  const getPrivateRolemateClientIds = (room: Room, player: Player): string[] => {
    if (player.isSpectator === true) return []
    if (player.role !== "MAFIA" && player.role !== "DOCTOR") return []

    return room.players
      .filter(
        (p) =>
          p.isSpectator !== true &&
          p.clientId !== player.clientId &&
          p.role === player.role
      )
      .map((p) => p.clientId)
  }

  const emitPrivateRoleToPlayer = (
    room: Room,
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
      rolemateClientIds: getPrivateRolemateClientIds(room, player),
    })
  }

  const emitPrivateRolesToRoom = (roomId: string) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return
    if (!room.gameStarted) return

    for (const p of room.players) {
      emitPrivateRoleToPlayer(room, cleanRoomId, room.gameNumber, p)
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
    reconcileRoomGameFlags(room)

    // Host-only
    if (room.hostId !== socket.data.clientId) {
      socket.emit("startRefused", { reason: "Only the host can start the game." })
      return
    }

    // Re-attach host socket defensively (refresh/reconnect-safe):
    // if the host somehow has a stale socket id or room membership,
    // we repair it before starting the next game.
    const hostPlayer = room.players.find((p) => p.clientId === socket.data.clientId)
    if (!hostPlayer) {
      socket.emit("startRefused", { reason: "Host player was not found in room." })
      return
    }

    hostPlayer.id = socket.id
    socket.join(cleanRoomId)

    if (room.gameStarted) {
      socket.emit("startRefused", { reason: "Game already started." })
      return
    }

    const activePlayers = getActivePlayers(room)

    if (!opts.force) {
      const allReady =
        activePlayers.length > 0 && activePlayers.every((p) => p.status === "READY")
      if (!allReady) {
        socket.emit("startRefused", { reason: "All players must be READY to start." })
        return
      }
    }

    // Convert spectators into active players ONLY at new game boundary.
    resetPlayersForNewGame(room)

    /* ------------------------------------------------------
          Safety: re-clamp roles at game boundary
      - Handles player-count changes between games
      - Prevents stale settings from producing invalid role mixes
    ------------------------------------------------------ */
    const playerCount = normalizeRoleCountsForRoom(room)

    if (playerCount <= 0) {
      socket.emit("startRefused", {
        reason: "Start refused: at least one non-spectator player is required.",
      })
      return
    }

    /* ------------------------------------------------------
          Safety: refuse unwinnable start states
      - With parity-win rule (mafia >= non-mafia), very low
        player counts can end instantly at phase start.
      - Refuse early so host gets a clear reason instead of
        a silent immediate GAMEOVER.
    ------------------------------------------------------ */
    const plannedMafiaCount = Math.min(room.settings.roleCount.mafia, playerCount)
    const plannedNonMafiaCount = Math.max(0, playerCount - plannedMafiaCount)

    if (plannedMafiaCount <= 0) {
      socket.emit("startRefused", { reason: "Start refused: at least 1 mafia is required." })
      return
    }

    if (plannedMafiaCount >= plannedNonMafiaCount) {
      socket.emit("startRefused", {
        reason:
          "Start refused: not enough non-mafia players (need more players so mafia is less than civilians at game start).",
      })
      return
    }

    // IMPORTANT (new game boundary):
    // If previous game ended in GAMEOVER, reset phase metadata BEFORE
    // marking gameStarted=true, otherwise startPhase() will short-circuit.
    clearPhaseScheduling(room)
    room.phase = "LOBBY"

    room.gameStarted = true
    room.gameNumber += 1

    // Clear any buffered actions from previous games (safety)
    clearGameplayRoleActions(cleanRoomId)

    // Assign roles now that the game is starting
    assignRolesForNewGame(room)

    startPhase(cleanRoomId, "DAY")

    // If startPhase did not successfully enter active gameplay,
    // do not emit "gameStarted" or private roles.
    const updatedRoom = rooms[cleanRoomId]
    if (!updatedRoom || !updatedRoom.gameStarted || updatedRoom.phase === "GAMEOVER") {
      if (updatedRoom?.phase === "GAMEOVER") {
        socket.emit("startRefused", {
          reason:
            "Start refused: game would end immediately from the current alive role balance.",
        })
      }
      emitRoomState(cleanRoomId)
      return
    }

    emitPrivateRolesToRoom(cleanRoomId)

    // Broadcast state + a simple event (no role assignment here)
    emitRoomState(cleanRoomId)
    io.to(cleanRoomId).emit("gameStarted", {
      roomId: cleanRoomId,
      gameNumber: room.gameNumber,
    })

    // Replay private roles shortly after gameStarted so clients that just
    // switched from Lobby -> Game still receive role data reliably.
    const startedGameNumber = room.gameNumber
    setTimeout(() => {
      const r = rooms[cleanRoomId]
      if (!r) return
      if (!r.gameStarted) return
      if (r.gameNumber !== startedGameNumber) return
      emitPrivateRolesToRoom(cleanRoomId)
    }, 150)
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
      clearRoomRoleMemory(cleanRoomId)
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
      s.emit("kicked", { roomId: cleanRoomId, reason: "LMAO You Got Booted From The Game." })
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
        rolemateClientIds: getPrivateRolemateClientIds(room, existingPlayer),
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

  const setHostParticipationLocal = (
    socket: Socket,
    roomId: string,
    participates: boolean
  ) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return

    if (room.hostId !== socket.data.clientId) {
      socket.emit("hostParticipationRefused", {
        reason: "Only the host can change host participation.",
      })
      return
    }

    if (room.gameStarted) {
      socket.emit("hostParticipationRefused", {
        reason: "Host participation can only be changed in lobby before game start.",
      })
      return
    }

    const hostPlayer = room.players.find((p) => p.clientId === room.hostId)
    if (!hostPlayer) {
      socket.emit("hostParticipationRefused", {
        reason: "Host player was not found in room.",
      })
      return
    }

    const nextParticipates = participates === true
    room.hostParticipates = nextParticipates

    hostPlayer.isSpectator = !nextParticipates
    hostPlayer.alive = true
    hostPlayer.voteCount = 0
    hostPlayer.role = "CIVILIAN"
    hostPlayer.status = nextParticipates ? "NOT READY" : "CONNECTED"

    emitRoomState(cleanRoomId)
  }

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

    // Phase rules (server authoritative)
    const phase = room.phase

    const refuse = (reason: string) => {
      socket.emit("actionRefused", { kind, reason })
    }

    const skipAllowed =
      kind === "MAFIA_KILL_VOTE" ||
      kind === "DOCTOR_SAVE" ||
      kind === "DETECTIVE_CHECK" ||
      kind === "CIVILIAN_VOTE"

    const isSkipAction = targetClientId === SKIP_TARGET_CLIENT_ID

    if (isSkipAction && !skipAllowed) {
      return refuse("This action type does not support skip.")
    }

    let target: Player | null = null

    // Target validity (only for non-skip actions)
    if (!isSkipAction) {
      target = room.players.find((p) => p.clientId === targetClientId) ?? null
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
    }

    // Role gating + phase gating
    if (kind === "MAFIA_KILL_VOTE") {
      if (phase !== "NIGHT") return refuse("Mafia can only vote to kill during NIGHT.")
      if (actor.role !== "MAFIA") return refuse("Only Mafia can submit mafia kill votes.")
      if (!isSkipAction && target?.role === "MAFIA") return refuse("Mafia cannot target fellow mafia.")
    } else if (kind === "DOCTOR_SAVE") {
      if (phase !== "NIGHT") return refuse("Doctor can only save during NIGHT.")
      if (actor.role !== "DOCTOR") return refuse("Only Doctor can submit doctor saves.")

      // Doctor self-save only once per game
      if (!isSkipAction && targetClientId === fromClientId) {
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

      // Sheriff one-time use per game
      const used = getSheriffUsed(cleanRoomId, room.gameNumber, fromClientId)
      if (used) return refuse("Sheriff can only shoot once per game.")
    } else if (kind === "CIVILIAN_VOTE") {
      if (phase !== "VOTING") return refuse("Votes can only be submitted during VOTING.")
      // One vote per player in voting phase.
      // Once submitted, player must wait for the phase to resolve.
      const alreadyVoted = getRoleActions(cleanRoomId, "VOTING").some(
        (a: any) => a?.kind === "CIVILIAN_VOTE" && String(a.fromClientId || "").trim() === fromClientId
      )
      if (alreadyVoted) return refuse("You already voted. Waiting for others.")
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

    // If everyone has submitted a vote, skip remaining timer and resolve now.
    if (kind === "CIVILIAN_VOTE" && allEligibleVotersSubmitted(room, cleanRoomId)) {
      finalizeVotingPhase(room, cleanRoomId)
    }
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
            Helper: re-send my private role (private)
    - Replays "yourRole" to requesting socket only
    - Fixes race where client enters Game screen after initial
      role emit and would otherwise show "(unknown)"
  ------------------------------------------------------ */

  const requestMyRoleLocal = (socket: Socket, roomId: string) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return
    if (!room.gameStarted) return

    const fromClientId = String(socket.data.clientId || "").trim()
    if (!fromClientId) return

    const player = room.players.find((p) => p.clientId === fromClientId)
    if (!player) return
    if (player.isSpectator === true) return

    // Emit directly to requesting socket to avoid stale player.id issues.
    socket.emit("yourRole", {
      roomId: cleanRoomId,
      gameNumber: room.gameNumber,
      role: player.role,
      rolemateClientIds: getPrivateRolemateClientIds(room, player),
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
    setHostParticipationLocal,
    setPlayerAlive,
    setPlayerRole,
    setPlayerStatus,
    updateRoomSettings,
    handleReconnect,
    startGameLocal,
    kickPlayerLocal,
    submitRoleActionLocal,
    requestMyActionsLocal,
    requestMyRoleLocal,
  }
}
