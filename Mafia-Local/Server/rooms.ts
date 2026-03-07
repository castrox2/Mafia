import type { Server as SocketIOServer } from "socket.io"
import type { Socket } from "socket.io"
import type { MafiaKillVoteAction, DoctorSaveAction, DetectiveCheckAction, SheriffShootAction } from "./roles/types.js"
import { SKIP_TARGET_CLIENT_ID } from "./roles/types.js"
import type { Player, PlayerRole, PlayerStatus } from "./players.js"
import {
  ROOM_CODE_CHARSET,
  ROOM_CODE_LENGTH,
  TIMER_MAX_SECONDS,
  TIMER_MIN_SECONDS,
  isValidRoomId,
  normalizeRoomId,
} from "../Shared/events.js"
import type {
  BotcRoleDistributionPayload,
  BotcRoleGroupKey,
  BotcScriptSource,
  BotcScriptSummaryPayload,
  GameSettingsPayload,
  HostParticipationRefusedPayload,
  ImportBotcScriptPayload,
  MafiaClientToServerEvents,
  MafiaPhase,
  MafiaRoomType,
  MafiaWinner,
  MafiaServerToClientEvents,
  MafiaSocketData,
  PhaseTimersPayload,
  RoleAssignmentCountsPayload,
  RoundSummaryPayload,
  RoleSelectorHostCountsPayload,
  RoleSelectorSettingsPayload,
  RoleCountPayload,
  SetHostParticipationPayload,
  SubmitRoleActionPayload,
} from "../Shared/events.js"
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
const BOT_CLIENT_PREFIX = "bot-"
const MAX_CLASSIC_ROOM_PLAYERS = 15
const CLASSIC_ROLE_SET = new Set<PlayerRole>([
  "CIVILIAN",
  "MAFIA",
  "DOCTOR",
  "DETECTIVE",
  "SHERIFF",
])

/* ======================================================
                          Types
====================================================== */

export type PhaseTimers = PhaseTimersPayload
export type RoleCount = RoleCountPayload
export type Phase = MafiaPhase
export type GameSettings = GameSettingsPayload

type MafiaIoServer = SocketIOServer<
  MafiaClientToServerEvents,
  MafiaServerToClientEvents,
  Record<string, never>,
  MafiaSocketData
>

type MafiaServerSocket = Socket<
  MafiaClientToServerEvents,
  MafiaServerToClientEvents,
  Record<string, never>,
  MafiaSocketData
>

type Room = {
  roomType: MafiaRoomType
  hostId: string
  hostParticipates: boolean
  players: Player[]
  manualRoleOverrides: Record<string, PlayerRole> | null
  settings: GameSettings
  roleSelectorSettings: RoleSelectorSettingsPayload | null
  botcScriptSummary: BotcScriptSummaryPayload | null
  botcScriptRaw: unknown | null
  roomLocked: boolean

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

type BotcRoleDistribution = {
  townsfolk: number
  outsiders: number
  minions: number
  demons: number
}

/* ======================================================
                    Rooms Manager
====================================================== */

export const createRoomsManager = (io: MafiaIoServer) => {
  const rooms: Record<string, Room> = {}

  /* ------------------------------------------------------
                  Normalization helpers
  ------------------------------------------------------ */

  const normalizeName = (name: string) =>
    (name || "").trim()

  const isBotPlayer = (player: Player): boolean =>
    player.isBot === true

  const hasHumanPlayers = (room: Room): boolean =>
    room.players.some((player) => !isBotPlayer(player))

  const randomRoomToken = (length = 4): string => {
    let token = ""
    for (let i = 0; i < length; i += 1) {
      const idx = Math.floor(Math.random() * ROOM_CODE_CHARSET.length)
      token += ROOM_CODE_CHARSET[idx] ?? "X"
    }
    return token
  }

  const createUniqueBotClientId = (room: Room): string => {
    const usedIds = new Set(room.players.map((p) => p.clientId))

    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const candidate = `${BOT_CLIENT_PREFIX}${randomRoomToken(4)}`
      if (!usedIds.has(candidate)) return candidate
    }

    return `${BOT_CLIENT_PREFIX}${Date.now().toString(36)}`
  }

  const createUniqueBotName = (room: Room): string => {
    const usedNames = new Set(
      room.players.map((p) => String(p.name || "").trim().toLowerCase())
    )

    for (let idx = 1; idx <= 9999; idx += 1) {
      const candidate = `Bot ${idx}`
      if (!usedNames.has(candidate.toLowerCase())) return candidate
    }

    return `Bot ${Date.now().toString(36)}`
  }

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
    manualRoleAssignEnabled: false,
  })

  const defaultRoleSelectorSettings = (): RoleSelectorSettingsPayload => ({
    scriptMode: "REGULAR_MAFIA",
    allowRedeal: false,
  })

  const MAX_BOTC_SCRIPT_BYTES = 200_000

  const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null && !Array.isArray(value)
  }

  const buildFallbackScriptId = () => `custom-${Date.now().toString(36)}`

  const extractRoleIdsDeep = (
    value: unknown,
    opts?: { includeObjectId?: boolean }
  ): string[] => {
    const roleIds: string[] = []
    const includeObjectId = opts?.includeObjectId ?? true

    const walk = (node: unknown, allowObjectId: boolean) => {
      if (typeof node === "string") {
        const next = node.trim()
        if (next && next !== "_meta") roleIds.push(next)
        return
      }

      if (Array.isArray(node)) {
        for (const item of node) {
          walk(item, true)
        }
        return
      }

      if (!isPlainObject(node)) return

      if (allowObjectId) {
        const id = typeof node.id === "string" ? node.id.trim() : ""
        if (id && id !== "_meta") roleIds.push(id)
      }

      for (const next of Object.values(node)) {
        if (Array.isArray(next) || isPlainObject(next)) {
          walk(next, true)
        }
      }
    }

    walk(value, includeObjectId)
    return roleIds
  }

  const dedupeRoleIds = (roleIds: string[]): string[] => {
    const seen = new Set<string>()
    const unique: string[] = []

    for (const roleId of roleIds) {
      const clean = roleId.trim()
      if (!clean) continue
      if (seen.has(clean)) continue
      seen.add(clean)
      unique.push(clean)
    }

    return unique
  }

  const normalizeBotcRoleKey = (value: string): string =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")

  const BOTC_ROLE_GROUPS = {
    TOWNSFOLK: [
      "Acrobat", "Alchemist", "Amnesiac", "Artist", "Atheist", "Balloonist",
      "Banshee", "Bounty Hunter", "Cannibal", "Chambermaid", "Chef", "Choirboy",
      "Clockmaker", "Courtier", "Cult Leader", "Dreamer", "Empath", "Engineer",
      "Exorcist", "Farmer", "Fisherman", "Flowergirl", "Fool", "Fortune Teller",
      "Gambler", "General", "Gossip", "Grandmother", "High Priestess", "Huntsman",
      "Innkeeper", "Investigator", "Juggler", "King", "Knight", "Librarian",
      "Lycanthrope", "Lyncanthrope", "Magician", "Mathematician", "Mayor",
      "Minstrel", "Monk", "Nightwatchman", "Noble", "Oracle", "Pacifist",
      "Philosopher", "Pixie", "Poppy Grower", "Preacher", "Princess",
      "Professor", "Ravenkeeper", "Sage", "Sailor", "Savant", "Seamstress",
      "Seamstres", "Shugenja", "Slayer", "Snake Charmer", "Soldier", "Steward",
      "Tea Lady", "Town Crier", "Undertaker", "Village Idiot", "Virgin",
      "Washerwoman",
    ],
    OUTSIDER: [
      "Barber", "Butler", "Damsel", "Drunk", "Golem", "Goon", "Hatter",
      "Heretic", "Hermit", "Klutz", "Lunatic", "Moonchild", "Mutant", "Ogre",
      "Plague Doctor", "Politician", "Puzzlemaster", "Recluse", "Saint",
      "Snitch", "Sweetheart", "Tinker", "Zealot",
    ],
    MINION: [
      "Assassin", "Boffin", "Boomdandy", "Cerenovus", "Devil's Advocate",
      "Evil Twin", "Fearmonger", "Fearmongerer", "Goblin", "Godfather", "Harpy",
      "Marionette", "Mastermind", "Mezepheles", "Organ Grinder", "Pit-Hag",
      "Poisoner", "Psychopath", "Scarlet Woman", "Spy", "Summoner", "Vizier",
      "Widow", "Witch", "Wizard", "Wraith", "Xaan", "Baron",
    ],
    DEMON: [
      "Al-Hadikhia", "Fang Gu", "Imp", "Kazali", "Legion", "Leviathan",
      "Lil' Monsta", "Lleech", "Lord of Typhon", "Lord of Typhoon", "No Dashii",
      "Ojo", "Po", "Pukka", "Riot", "Shabaloth", "Vigormortis", "Vortox",
      "Yaggababble", "Zombuul",
    ],
  } as const

  const BOTC_ROLE_GROUP_BY_KEY = (() => {
    const map = new Map<string, BotcRoleGroupKey>()

    const addNames = (group: BotcRoleGroupKey, names: readonly string[]) => {
      for (const name of names) {
        map.set(normalizeBotcRoleKey(name), group)
      }
    }

    addNames("TOWNSFOLK", BOTC_ROLE_GROUPS.TOWNSFOLK)
    addNames("OUTSIDER", BOTC_ROLE_GROUPS.OUTSIDER)
    addNames("MINION", BOTC_ROLE_GROUPS.MINION)
    addNames("DEMON", BOTC_ROLE_GROUPS.DEMON)
    return map
  })()

  const groupBotcRoleIds = (roleIds: string[]) => {
    const grouped = {
      townsfolk: [] as string[],
      outsiders: [] as string[],
      minions: [] as string[],
      demons: [] as string[],
      others: [] as string[],
    }

    for (const roleId of roleIds) {
      const key = normalizeBotcRoleKey(roleId)
      const group = BOTC_ROLE_GROUP_BY_KEY.get(key) ?? "OTHER"

      if (group === "TOWNSFOLK") grouped.townsfolk.push(roleId)
      else if (group === "OUTSIDER") grouped.outsiders.push(roleId)
      else if (group === "MINION") grouped.minions.push(roleId)
      else if (group === "DEMON") grouped.demons.push(roleId)
      else grouped.others.push(roleId)
    }

    const sortAsc = (values: string[]) => values.sort((a, b) => a.localeCompare(b))

    return {
      townsfolk: sortAsc(grouped.townsfolk),
      outsiders: sortAsc(grouped.outsiders),
      minions: sortAsc(grouped.minions),
      demons: sortAsc(grouped.demons),
      others: sortAsc(grouped.others),
    }
  }

  const BOTC_DISTRIBUTION_BY_PLAYER_COUNT: Record<number, BotcRoleDistribution> = {
    5: { townsfolk: 3, outsiders: 0, minions: 1, demons: 1 },
    6: { townsfolk: 3, outsiders: 1, minions: 1, demons: 1 },
    7: { townsfolk: 5, outsiders: 0, minions: 1, demons: 1 },
    8: { townsfolk: 5, outsiders: 1, minions: 1, demons: 1 },
    9: { townsfolk: 5, outsiders: 2, minions: 1, demons: 1 },
    10: { townsfolk: 7, outsiders: 0, minions: 2, demons: 1 },
    11: { townsfolk: 7, outsiders: 1, minions: 2, demons: 1 },
    12: { townsfolk: 7, outsiders: 2, minions: 2, demons: 1 },
    13: { townsfolk: 9, outsiders: 0, minions: 3, demons: 1 },
    14: { townsfolk: 9, outsiders: 1, minions: 3, demons: 1 },
    15: { townsfolk: 9, outsiders: 2, minions: 3, demons: 1 },
  }

  const getBotcDistributionForPlayerCount = (
    playerCount: number
  ): BotcRoleDistribution | null => {
    if (playerCount < 5) return null
    if (playerCount <= 15) {
      return BOTC_DISTRIBUTION_BY_PLAYER_COUNT[playerCount] ?? null
    }

    // "15+" script setup: keep outsider/minion/demon counts stable and add extra seats as townsfolk.
    const base = BOTC_DISTRIBUTION_BY_PLAYER_COUNT[15]!
    return {
      ...base,
      townsfolk: base.townsfolk + (playerCount - 15),
    }
  }

  const getBotcRoleGroupForRoleId = (roleId: string): BotcRoleGroupKey =>
    BOTC_ROLE_GROUP_BY_KEY.get(normalizeBotcRoleKey(roleId)) ?? "OTHER"

  const validateBotcScriptForDistribution = (
    summary: BotcScriptSummaryPayload,
    distribution: BotcRoleDistribution
  ): string | null => {
    const shortages: string[] = []

    if (summary.groupedRoleIds.townsfolk.length < distribution.townsfolk) {
      shortages.push(
        `townsfolk ${summary.groupedRoleIds.townsfolk.length}/${distribution.townsfolk}`
      )
    }
    if (summary.groupedRoleIds.outsiders.length < distribution.outsiders) {
      shortages.push(
        `outsiders ${summary.groupedRoleIds.outsiders.length}/${distribution.outsiders}`
      )
    }
    if (summary.groupedRoleIds.minions.length < distribution.minions) {
      shortages.push(
        `minions ${summary.groupedRoleIds.minions.length}/${distribution.minions}`
      )
    }
    if (summary.groupedRoleIds.demons.length < distribution.demons) {
      shortages.push(
        `demons ${summary.groupedRoleIds.demons.length}/${distribution.demons}`
      )
    }

    if (shortages.length <= 0) return null
    return `Script \"${summary.name}\" does not have enough roles for BOCT distribution (${shortages.join(", ")}).`
  }

  const parseBotcScript = (rawJson: string, source: BotcScriptSource) => {
    const parsed = JSON.parse(rawJson) as unknown

    let scriptName = "Custom BOCT Script"
    let scriptId = ""
    let roleIds: string[] = []

    if (Array.isArray(parsed)) {
      roleIds = extractRoleIdsDeep(parsed, { includeObjectId: true })

      const meta = parsed.find((item) => {
        if (!isPlainObject(item)) return false
        return String(item.id || "").trim() === "_meta"
      })

      if (isPlainObject(meta)) {
        const maybeName = typeof meta.name === "string" ? meta.name.trim() : ""
        const maybeId = typeof meta.scriptId === "string" ? meta.scriptId.trim() : ""
        if (maybeName) scriptName = maybeName
        if (maybeId) scriptId = maybeId
      }
    } else if (isPlainObject(parsed)) {
      const maybeName = typeof parsed.name === "string" ? parsed.name.trim() : ""
      const maybeId = typeof parsed.id === "string" ? parsed.id.trim() : ""
      if (maybeName) scriptName = maybeName
      if (maybeId) scriptId = maybeId

      roleIds = extractRoleIdsDeep(parsed, { includeObjectId: false })
    } else {
      throw new Error("Script JSON must be an object or an array.")
    }

    const uniqueRoleIds = dedupeRoleIds(roleIds)

    if (uniqueRoleIds.length <= 0) {
      throw new Error("Script must contain at least one role id.")
    }

    const summary: BotcScriptSummaryPayload = {
      id: scriptId || buildFallbackScriptId(),
      name: scriptName,
      source,
      roleCount: uniqueRoleIds.length,
      roleIds: uniqueRoleIds,
      groupedRoleIds: groupBotcRoleIds(uniqueRoleIds),
      importedAtMs: Date.now(),
    }

    return {
      parsed,
      summary,
    }
  }

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
    daySec: clampInt(
      timers?.daySec ?? current.daySec,
      TIMER_MIN_SECONDS,
      TIMER_MAX_SECONDS
    ),
    nightSec: clampInt(
      timers?.nightSec ?? current.nightSec,
      TIMER_MIN_SECONDS,
      TIMER_MAX_SECONDS
    ),
    voteSec: clampInt(
      timers?.voteSec ?? current.voteSec,
      TIMER_MIN_SECONDS,
      TIMER_MAX_SECONDS
    ),
    discussionSec: clampInt(
      timers?.discussionSec ?? current.discussionSec,
      TIMER_MIN_SECONDS,
      TIMER_MAX_SECONDS
    ),
    pubDiscussionSec: clampInt(
      timers?.pubDiscussionSec ?? current.pubDiscussionSec,
      TIMER_MIN_SECONDS,
      TIMER_MAX_SECONDS
    ),
  })

  const normalizeManualRoleAssignEnabled = (
    nextValue: boolean | undefined,
    currentValue: boolean | undefined
  ): boolean => {
    if (typeof nextValue === "boolean") return nextValue
    return currentValue === true
  }

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

  const normalizeRoleSelectorSettings = (
    incoming: Partial<RoleSelectorSettingsPayload> | undefined,
    current: RoleSelectorSettingsPayload
  ): RoleSelectorSettingsPayload => {
    const nextAllowRedeal =
      typeof incoming?.allowRedeal === "boolean"
        ? incoming.allowRedeal
        : current.allowRedeal

    const incomingScript = incoming?.scriptMode
    const nextScriptMode =
      incomingScript === "REGULAR_MAFIA" || incomingScript === "BLOOD_ON_THE_CLOCKTOWER"
        ? incomingScript
        : current.scriptMode

    return {
      scriptMode: nextScriptMode,
      allowRedeal: nextAllowRedeal,
    }
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

  const getAssignedRoleCounts = (room: Room): RoleAssignmentCountsPayload => {
    const counts: RoleAssignmentCountsPayload = {
      mafia: 0,
      doctor: 0,
      detective: 0,
      sheriff: 0,
      civilian: 0,
    }

    for (const player of getActivePlayers(room)) {
      if (player.role === "MAFIA") counts.mafia += 1
      else if (player.role === "DOCTOR") counts.doctor += 1
      else if (player.role === "DETECTIVE") counts.detective += 1
      else if (player.role === "SHERIFF") counts.sheriff += 1
      else counts.civilian += 1
    }

    return counts
  }

  const getAssignedBotcRoleCounts = (
    room: Room
  ): BotcRoleDistributionPayload => {
    const counts: BotcRoleDistributionPayload = {
      townsfolk: 0,
      outsiders: 0,
      minions: 0,
      demons: 0,
      others: 0,
    }

    for (const player of getActivePlayers(room)) {
      const group = getBotcRoleGroupForRoleId(String(player.role || ""))
      if (group === "TOWNSFOLK") counts.townsfolk += 1
      else if (group === "OUTSIDER") counts.outsiders += 1
      else if (group === "MINION") counts.minions += 1
      else if (group === "DEMON") counts.demons += 1
      else counts.others += 1
    }

    return counts
  }

  const emitRoleSelectorHostCounts = (cleanRoomId: string) => {
    const room = rooms[cleanRoomId]
    if (!room) return
    if (room.roomType !== "ROLE_SELECTOR") return

    const hostPlayer = room.players.find((p) => p.clientId === room.hostId)
    if (!hostPlayer) return

    const hostSocket = io.sockets.sockets.get(hostPlayer.id)
    if (!hostSocket) return

    const scriptMode =
      room.roleSelectorSettings?.scriptMode ?? "REGULAR_MAFIA"

    const payload: RoleSelectorHostCountsPayload = {
      roomId: cleanRoomId,
      gameNumber: room.gameNumber,
      started: room.gameStarted,
      roomLocked: room.roomLocked,
      scriptMode,
      counts: getAssignedRoleCounts(room),
      botcCounts:
        scriptMode === "BLOOD_ON_THE_CLOCKTOWER"
          ? getAssignedBotcRoleCounts(room)
          : null,
    }

    hostSocket.emit("roleSelectorHostCounts", payload)
  }

  const applyHostParticipationState = (
    hostPlayer: Player,
    participates: boolean,
    opts: {
      resetRoleState: boolean
      setConnectedStatusWhenSpectating: boolean
    }
  ) => {
    hostPlayer.isSpectator = !participates

    if (participates && opts.resetRoleState) {
      hostPlayer.alive = true
      hostPlayer.voteCount = 0
      hostPlayer.role = "CIVILIAN"
      hostPlayer.status = "NOT READY"
      return
    }

    if (!participates && opts.setConnectedStatusWhenSpectating) {
      hostPlayer.status = "CONNECTED"
    }
  }

  const emitRoomState = (roomId: string) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return

    reconcileRoomGameFlags(room)
    room.players = dedupePlayersByClientId(room.players)

    io.to(cleanRoomId).emit("roomState", {
      roomId: cleanRoomId,
      roomType: room.roomType,
      hostId: room.hostId,
      hostParticipates: room.hostParticipates,

      // IMPORTANT (anti-spoiler):
      // Never broadcast real roles in roomState during a running game.
      // Roles should be sent privately to each player later (separate event).
      players: room.players.map((p) => ({
        ...p,
        role: room.gameStarted ? "CIVILIAN" : p.role,
      })),

      settings: {
        timers: room.settings.timers,
        roleCount: room.settings.roleCount,
        manualRoleAssignEnabled: room.settings.manualRoleAssignEnabled === true,
      },
      roleSelectorSettings: room.roleSelectorSettings,
      botcScriptSummary: room.botcScriptSummary,
      roleBounds: getRoleBounds(getActivePlayerCount(room)),
      gameStarted: room.gameStarted,
      roomLocked: room.roomLocked,
      gameNumber: room.gameNumber,
      phase: room.phase,
      phaseEndTime: room.phaseEndTime,
    })

    emitRoleSelectorHostCounts(cleanRoomId)
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
      isSpectator: false,
      alive: true,
      status: "NOT READY",
      voteCount: 0,
      role: "CIVILIAN",
    }))

    const hostPlayer = room.players.find((p) => p.clientId === room.hostId)
    if (!hostPlayer) return

    applyHostParticipationState(hostPlayer, room.hostParticipates === true, {
      resetRoleState: true,
      setConnectedStatusWhenSpectating: true,
    })
  }

  const resetPlayersForRoleSelectorDeal = (room: Room) => {
    room.players = room.players.map((p) => ({
      ...p,
      isSpectator: p.clientId === room.hostId ? p.isSpectator : false,
      alive: true,
      voteCount: 0,
      role: "CIVILIAN",
      status: p.status === "DISCONNECTED" ? "DISCONNECTED" : "CONNECTED",
    }))

    const hostPlayer = room.players.find((p) => p.clientId === room.hostId)
    if (!hostPlayer) return

    applyHostParticipationState(hostPlayer, room.hostParticipates === true, {
      resetRoleState: true,
      setConnectedStatusWhenSpectating: true,
    })
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

type Winner = MafiaWinner

  const getWinnerFromAliveState = (room: Room): Winner | null => {
    const aliveActivePlayers = getActivePlayers(room).filter((p) => p.alive === true)

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

    let killedClientId: string | undefined
    let killedPlayerName: string | undefined

    // Apply kill (if any)
    if (res.killedClientId) {
      killedClientId = res.killedClientId
      const target = room.players.find((p) => p.clientId === res.killedClientId)
      if (target && target.isSpectator !== true) {
        target.alive = false
        killedPlayerName = target.name
      }
    }

    const nightSummaryPayload: RoundSummaryPayload = {
      roomId: cleanRoomId,
      gameNumber: room.gameNumber,
      someoneDied: Boolean(killedClientId),
    }

    if (killedClientId) {
      nightSummaryPayload.killedClientId = killedClientId
    }
    if (killedPlayerName) {
      nightSummaryPayload.killedPlayerName = killedPlayerName
    }

    // Public night summary (anti-spoiler)
    io.to(cleanRoomId).emit("nightSummary", nightSummaryPayload)

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

    const eligibleVoterIds = getActivePlayers(room)
      .filter((p) => p.alive === true)
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

  const assignNextHost = (room: Room) => {
    const nextHost = room.players.find((p) => !isBotPlayer(p)) ?? room.players[0]
    room.hostId = nextHost?.clientId ?? ""
    room.hostParticipates = nextHost ? nextHost.isSpectator !== true : false
  }

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
        assignNextHost(room)
      }

      if (before !== room.players.length) {
        if (room.players.length === 0 || !hasHumanPlayers(room)) {
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

  const handleDisconnecting = (socket: MafiaServerSocket) => {
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
    socket: MafiaServerSocket,
    roomId: string,
    playerName: string,
    clientId: string,
    roomType: MafiaRoomType = "CLASSIC"
  ) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const cleanName = normalizeName(playerName)
    if (!cleanRoomId || !cleanName) return

    rooms[cleanRoomId] = {
      roomType,
      hostId: clientId, // Host is stable identity
      hostParticipates: true,
      players: [],
      manualRoleOverrides: null,
      settings: defaultSettings(),
      roleSelectorSettings:
        roomType === "ROLE_SELECTOR" ? defaultRoleSelectorSettings() : null,
      botcScriptSummary: null,
      botcScriptRaw: null,
      roomLocked: false,

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
  socket: MafiaServerSocket,
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
    timers:
      room.roomType === "ROLE_SELECTOR"
        ? room.settings.timers
        : normalizeTimers(settings.timers, room.settings.timers),
    roleCount: normalizeRoleCount(
      settings.roleCount,
      room.settings.roleCount,
      playerCount,
      bounds
    ),
    manualRoleAssignEnabled: normalizeManualRoleAssignEnabled(
      settings.manualRoleAssignEnabled,
      room.settings.manualRoleAssignEnabled
    ),
  }

  console.log("DEBUG: next roleCount", next.roleCount)

  room.settings = next
  emitRoomState(cleanRoomId)
}

  const updateRoleSelectorSettingsLocal = (
    socket: MafiaServerSocket,
    roomId: string,
    settings: Partial<RoleSelectorSettingsPayload>
  ) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return

    if (room.roomType !== "ROLE_SELECTOR") {
      socket.emit("settingsRefused", { reason: "This room does not support role selector settings." })
      return
    }

    if (room.hostId !== socket.data.clientId) {
      socket.emit("settingsRefused", { reason: "Only the host can update settings." })
      return
    }

    const current = room.roleSelectorSettings ?? defaultRoleSelectorSettings()
    room.roleSelectorSettings = normalizeRoleSelectorSettings(settings, current)
    emitRoomState(cleanRoomId)
  }

  const importBotcScriptLocal = (
    socket: MafiaServerSocket,
    payload: ImportBotcScriptPayload
  ) => {
    const cleanRoomId = normalizeRoomId(payload.roomId)
    const room = rooms[cleanRoomId]
    if (!room) return

    if (room.roomType !== "ROLE_SELECTOR") {
      socket.emit("settingsRefused", {
        reason: "This room does not support BOCT scripts.",
      })
      return
    }

    if (room.hostId !== socket.data.clientId) {
      socket.emit("settingsRefused", {
        reason: "Only the host can import BOCT scripts.",
      })
      return
    }

    const roleSelectorSettings =
      room.roleSelectorSettings ?? defaultRoleSelectorSettings()

    if (roleSelectorSettings.scriptMode !== "BLOOD_ON_THE_CLOCKTOWER") {
      socket.emit("settingsRefused", {
        reason:
          "Switch room mode to Blood on the Clocktower in Role Selector settings before importing.",
      })
      return
    }

    const rawJson = String(payload.rawJson || "").trim()
    if (!rawJson) {
      socket.emit("settingsRefused", { reason: "Script import failed: empty JSON." })
      return
    }

    if (rawJson.length > MAX_BOTC_SCRIPT_BYTES) {
      socket.emit("settingsRefused", {
        reason: `Script import failed: JSON is too large (max ${MAX_BOTC_SCRIPT_BYTES} chars).`,
      })
      return
    }

    const source: BotcScriptSource =
      payload.source === "UPLOAD" ? "UPLOAD" : "PASTE"

    try {
      const { parsed, summary } = parseBotcScript(rawJson, source)
      room.botcScriptRaw = parsed
      room.botcScriptSummary = summary
      emitRoomState(cleanRoomId)
      io.to(cleanRoomId).emit("botcScriptImported", {
        roomId: cleanRoomId,
        summary,
      })
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Invalid script format."
      socket.emit("settingsRefused", {
        reason: `Script import failed: ${message}`,
      })
    }
  }


  /* ------------------------------------------------------
                        Join Room
  ------------------------------------------------------ */

  const joinRoomLocal = (
    socket: MafiaServerSocket,
    roomId: string,
    playerName: string,
    clientId: string,
    expectedRoomType?: MafiaRoomType
  ) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const cleanName = normalizeName(playerName)
    if (!cleanRoomId || !cleanName) return

    // Room code validation
    if (cleanRoomId.length !== ROOM_CODE_LENGTH) {
      socket.emit("roomInvalid", {
        reason: `Room Code MUST Be ${ROOM_CODE_LENGTH} Characters Long`,
      })
      return
    }

    if (!isValidRoomId(cleanRoomId)) {
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

    if (expectedRoomType && room.roomType !== expectedRoomType) {
      const expectedLabel =
        expectedRoomType === "ROLE_SELECTOR" ? "Role Assigner" : "Play Game"
      socket.emit("roomInvalid", {
        reason: `This room was created for a different mode. Please join from ${expectedLabel}.`,
      })
      return
    }

    const existing = room.players.find((p) => p.clientId === clientId)

    if (room.roomType === "ROLE_SELECTOR" && room.roomLocked && !existing) {
      socket.emit("roomInvalid", {
        reason: "This role selector room is locked after roles were dealt.",
      })
      return
    }

    const isHostClient = clientId === room.hostId
    const shouldSpectate = room.roomType === "ROLE_SELECTOR"
      ? Boolean(existing ? existing.isSpectator : (isHostClient && room.hostParticipates === false))
      : room.gameStarted === true || (isHostClient && room.hostParticipates === false)

    removeFromAllRooms(clientId, cleanRoomId)

    socket.join(cleanRoomId)
    
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

  const leaveRoomLocal = (socket: MafiaServerSocket, roomId: string) => {
    const cleanRoomId = normalizeRoomId(roomId)
    socket.leave(cleanRoomId)

    const room = rooms[cleanRoomId]
    if (!room) return

    room.players = room.players.filter((p) => p.clientId !== socket.data.clientId)

    if (room.hostId === socket.data.clientId) {
      assignNextHost(room)
    }

    if (room.players.length === 0) {
      clearRoomRoleMemory(cleanRoomId)
      delete rooms[cleanRoomId]
      io.to(cleanRoomId).emit("roomClosed", { roomId: cleanRoomId })
      return
    }

    if (!hasHumanPlayers(room)) {
      clearRoomRoleMemory(cleanRoomId)
      delete rooms[cleanRoomId]
      io.to(cleanRoomId).emit("roomClosed", { roomId: cleanRoomId })
      return
    }

    emitRoomState(cleanRoomId)
  }

  /* ------------------------------------------------------
                        Add Bot
      - Host-only
      - Classic rooms only
      - Lobby only (before game starts)
  ------------------------------------------------------ */

  const addBotLocal = (socket: MafiaServerSocket, roomId: string) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return

    const refuse = (reason: string) => {
      socket.emit("addBotRefused", { reason })
    }

    if (room.hostId !== socket.data.clientId) {
      refuse("Only the host can add bots.")
      return
    }

    if (room.roomType !== "CLASSIC") {
      refuse("Bots are only available in regular game lobbies.")
      return
    }

    if (room.gameStarted || room.phase !== "LOBBY") {
      refuse("Bots can only be added before the game starts.")
      return
    }

    if (room.players.length >= MAX_CLASSIC_ROOM_PLAYERS) {
      refuse(`Room is full (max ${MAX_CLASSIC_ROOM_PLAYERS} players).`)
      return
    }

    const botClientId = createUniqueBotClientId(room)
    const botName = createUniqueBotName(room)

    const botPlayer: Player = {
      id: `bot-socket-${cleanRoomId}-${botClientId}`,
      name: botName,
      clientId: botClientId,
      isBot: true,
      alive: true,
      role: "CIVILIAN",
      status: "READY",
      isSpectator: false,
      voteCount: 0,
      joinedAt: Date.now(),
    }

    room.players.push(botPlayer)
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

  const assignRolesForNewGame = (
    room: Room,
    opts?: { manualRoleOverrides?: Record<string, PlayerRole> | null }
  ): { ok: true } | { ok: false; reason: string } => {
    const activePlayers = getActivePlayers(room)

    // Safety: if no active players, nothing to do
    if (activePlayers.length === 0) {
      return { ok: false, reason: "At least one participant is required to deal roles." }
    }

    const roleSelectorSettings = room.roleSelectorSettings ?? defaultRoleSelectorSettings()
    const isBotcRoleSelector =
      room.roomType === "ROLE_SELECTOR" &&
      roleSelectorSettings.scriptMode === "BLOOD_ON_THE_CLOCKTOWER"

    if (isBotcRoleSelector) {
      const summary = room.botcScriptSummary
      if (!summary) {
        return { ok: false, reason: "Import a BOCT script first before dealing roles." }
      }

      const distribution = getBotcDistributionForPlayerCount(activePlayers.length)
      if (!distribution) {
        return {
          ok: false,
          reason: "BOCT role dealing requires at least 5 active players.",
        }
      }

      const validationError = validateBotcScriptForDistribution(summary, distribution)
      if (validationError) {
        return { ok: false, reason: validationError }
      }

      const pickRandomUnique = (source: string[], count: number): string[] => {
        if (count <= 0) return []
        return shuffleInPlace([...source]).slice(0, count)
      }

      const pool: string[] = [
        ...pickRandomUnique(summary.groupedRoleIds.townsfolk, distribution.townsfolk),
        ...pickRandomUnique(summary.groupedRoleIds.outsiders, distribution.outsiders),
        ...pickRandomUnique(summary.groupedRoleIds.minions, distribution.minions),
        ...pickRandomUnique(summary.groupedRoleIds.demons, distribution.demons),
      ]

      if (pool.length !== activePlayers.length) {
        return {
          ok: false,
          reason:
            "BOCT role dealing could not satisfy this player count with the imported script.",
        }
      }

      shuffleInPlace(activePlayers)
      shuffleInPlace(pool)

      let idx = 0
      for (const p of activePlayers) {
        p.role = pool[idx] ?? "CIVILIAN"
        idx += 1
      }

      for (const p of room.players) {
        if (p.isSpectator === true) {
          p.role = "CIVILIAN"
        }
      }

      return { ok: true }
    }

    const manualRoleOverrides = opts?.manualRoleOverrides ?? null
    const useManualRoleOverrides =
      room.roomType === "CLASSIC" &&
      manualRoleOverrides != null &&
      Object.keys(manualRoleOverrides).length > 0

    if (useManualRoleOverrides) {
      for (const p of activePlayers) {
        const overrideRole = manualRoleOverrides[p.clientId] ?? "CIVILIAN"
        p.role = CLASSIC_ROLE_SET.has(overrideRole) ? overrideRole : "CIVILIAN"
      }

      for (const p of room.players) {
        if (p.isSpectator === true) {
          p.role = "CIVILIAN"
        }
      }

      return { ok: true }
    }

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

    return { ok: true }
  }

  /* ------------------------------------------------------
            Helper: private role emit (anti-spoiler)
    - Sends role ONLY to the player’s current socket
    - Never broadcasts to the room
  ------------------------------------------------------ */

  const getPrivateRolemateClientIds = (room: Room, player: Player): string[] => {
    if (player.isSpectator === true) return []
    if (player.role !== "MAFIA" && player.role !== "DOCTOR") return []

    return getActivePlayers(room)
      .filter(
        (p) =>
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
    socket: MafiaServerSocket,
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

    if (room.roomType === "ROLE_SELECTOR") {
      const roleSelectorSettings =
        room.roleSelectorSettings ?? defaultRoleSelectorSettings()
      room.roleSelectorSettings = roleSelectorSettings

      if (roleSelectorSettings.scriptMode === "BLOOD_ON_THE_CLOCKTOWER") {
        if (!room.botcScriptSummary) {
          socket.emit("startRefused", {
            reason: "Import a BOCT script first before starting this room.",
          })
          return
        }
      }

      if (room.gameStarted) {
        socket.emit("startRefused", {
          reason: roleSelectorSettings.allowRedeal
            ? "Roles were already dealt. Use Redeal Roles to overwrite assignments."
            : "Roles were already dealt for this room.",
        })
        return
      }

      resetPlayersForRoleSelectorDeal(room)

      const playerCount =
        roleSelectorSettings.scriptMode === "REGULAR_MAFIA"
          ? normalizeRoleCountsForRoom(room)
          : getActivePlayerCount(room)
      if (playerCount <= 0) {
        socket.emit("startRefused", {
          reason: "At least one participant is required to deal roles.",
        })
        return
      }

      clearPhaseScheduling(room)
      room.phase = "LOBBY"
      room.phaseEndTime = null
      room.roomLocked = true
      room.gameStarted = true
      room.gameNumber += 1

      clearGameplayRoleActions(cleanRoomId)
      const roleAssignment = assignRolesForNewGame(room)
      if (!roleAssignment.ok) {
        room.roomLocked = false
        room.gameStarted = false
        room.gameNumber = Math.max(0, room.gameNumber - 1)
        socket.emit("startRefused", { reason: roleAssignment.reason })
        emitRoomState(cleanRoomId)
        return
      }

      emitPrivateRolesToRoom(cleanRoomId)
      emitRoomState(cleanRoomId)

      io.to(cleanRoomId).emit("gameStarted", {
        roomId: cleanRoomId,
        roomType: room.roomType,
        gameNumber: room.gameNumber,
      })

      const startedGameNumber = room.gameNumber
      setTimeout(() => {
        const r = rooms[cleanRoomId]
        if (!r) return
        if (!r.gameStarted) return
        if (r.gameNumber !== startedGameNumber) return
        emitPrivateRolesToRoom(cleanRoomId)
      }, 150)

      return
    }

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

    const manualRoleOverrides = room.manualRoleOverrides
    const useManualRoleOverrides =
      manualRoleOverrides != null && Object.keys(manualRoleOverrides).length > 0

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
    const plannedMafiaCount = useManualRoleOverrides
      ? getActivePlayers(room).reduce((count, player) => {
          const role = manualRoleOverrides?.[player.clientId]
          return role === "MAFIA" ? count + 1 : count
        }, 0)
      : Math.min(room.settings.roleCount.mafia, playerCount)
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
    room.roomLocked = false

    room.gameStarted = true
    room.gameNumber += 1

    // Clear any buffered actions from previous games (safety)
    clearGameplayRoleActions(cleanRoomId)

    // Assign roles now that the game is starting.
    const roleAssignment = assignRolesForNewGame(room, {
      manualRoleOverrides: useManualRoleOverrides ? manualRoleOverrides : null,
    })
    if (!roleAssignment.ok) {
      room.gameStarted = false
      room.gameNumber = Math.max(0, room.gameNumber - 1)
      socket.emit("startRefused", { reason: roleAssignment.reason })
      emitRoomState(cleanRoomId)
      return
    }

    // Manual role overrides are a lobby testing helper; consume after successful use.
    room.manualRoleOverrides = null

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
      roomType: room.roomType,
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

  const skipPhaseLocal = (socket: MafiaServerSocket, roomId: string) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return

    if (room.hostId !== socket.data.clientId) {
      socket.emit("startRefused", { reason: "Only the host can skip phases." })
      return
    }

    if (room.roomType !== "CLASSIC") {
      socket.emit("startRefused", {
        reason: "Phase skip is only available in classic game rooms.",
      })
      return
    }

    if (!room.gameStarted) {
      socket.emit("startRefused", { reason: "Game has not started yet." })
      return
    }

    if (room.phase === "GAMEOVER") {
      socket.emit("startRefused", { reason: "Cannot skip phase during game over." })
      return
    }

    if (room.phase === "LOBBY") {
      socket.emit("startRefused", { reason: "Cannot skip while still in lobby." })
      return
    }

    if (room.phase === "VOTING") {
      finalizeVotingPhase(room, cleanRoomId)
      return
    }

    clearPhaseTimeout(room)
    clearPhaseEndingTimeout(room)

    if (room.phase === "NIGHT") {
      applyNightResolution(room, cleanRoomId)
      if (maybeEndGameFromAliveState(room, cleanRoomId)) return
      emitRoomState(cleanRoomId)
      if (maybeEndGameFromAliveState(room, cleanRoomId)) return
      startPhase(cleanRoomId, nextPhase("NIGHT"))
      return
    }

    if (maybeEndGameFromAliveState(room, cleanRoomId)) return
    startPhase(cleanRoomId, nextPhase(room.phase))
  }

  const redealRoleSelectorLocal = (socket: MafiaServerSocket, roomId: string) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return

    if (room.roomType !== "ROLE_SELECTOR") {
      socket.emit("startRefused", { reason: "This room is not a role selector room." })
      return
    }

    if (room.hostId !== socket.data.clientId) {
      socket.emit("startRefused", { reason: "Only the host can redeal roles." })
      return
    }

    const roleSelectorSettings =
      room.roleSelectorSettings ?? defaultRoleSelectorSettings()

    if (!room.gameStarted) {
      socket.emit("startRefused", { reason: "Deal roles first before trying to redeal." })
      return
    }

    if (!roleSelectorSettings.allowRedeal) {
      socket.emit("startRefused", { reason: "Redeal is disabled in host settings." })
      return
    }

    const activePlayers = getActivePlayers(room)
    if (activePlayers.length <= 0) {
      socket.emit("startRefused", { reason: "No eligible players found for redeal." })
      return
    }

    if (roleSelectorSettings.scriptMode === "REGULAR_MAFIA") {
      normalizeRoleCountsForRoom(room)
    }

    room.gameNumber += 1
    const roleAssignment = assignRolesForNewGame(room)
    if (!roleAssignment.ok) {
      room.gameNumber = Math.max(1, room.gameNumber - 1)
      socket.emit("startRefused", { reason: roleAssignment.reason })
      emitRoomState(cleanRoomId)
      return
    }

    emitPrivateRolesToRoom(cleanRoomId)
    emitRoomState(cleanRoomId)
  }

  /* ------------------------------------------------------
                      Kick Player (host-only)
  ------------------------------------------------------ */

  const kickPlayerLocal = (socket: MafiaServerSocket, roomId: string, targetClientId: string) => {
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

  const handleReconnect = (socket: MafiaServerSocket, clientId: string) => {
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
    socket: MafiaServerSocket,
    payload: SetHostParticipationPayload
  ) => {
    const refuseHostParticipation = (reason: string) => {
      const payload: HostParticipationRefusedPayload = { reason }
      socket.emit("hostParticipationRefused", payload)
    }

    const cleanRoomId = normalizeRoomId(payload.roomId)
    const room = rooms[cleanRoomId]
    if (!room) return

    if (room.hostId !== socket.data.clientId) {
      refuseHostParticipation("Only the host can change host participation.")
      return
    }

    if (room.gameStarted) {
      refuseHostParticipation("Host participation can only be changed in lobby before game start.")
      return
    }

    const hostPlayer = room.players.find((p) => p.clientId === room.hostId)
    if (!hostPlayer) {
      refuseHostParticipation("Host player was not found in room.")
      return
    }

    const nextParticipates = payload.participates === true
    const prevParticipates = room.hostParticipates === true
    room.hostParticipates = nextParticipates

    applyHostParticipationState(hostPlayer, nextParticipates, {
      // Only reset role-related state when host transitions to participating.
      resetRoleState: prevParticipates === false && nextParticipates === true,
      // Keep prior status when toggling to spectator in lobby.
      setConnectedStatusWhenSpectating: false,
    })

    emitRoomState(cleanRoomId)
  }

  const setPlayerAlive = (roomId: string, playerId: string, alive: boolean) => {
    const room = rooms[normalizeRoomId(roomId)]
    if (!room) return
    room.players = setAliveList(room.players, playerId, alive)
    emitRoomState(roomId)
  }

  const setPlayerRole = (roomId: string, playerId: string, role: PlayerRole) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) return
    if (room.roomType === "ROLE_SELECTOR") return

    if (!room.gameStarted) {
      room.manualRoleOverrides = {
        ...(room.manualRoleOverrides ?? {}),
        [playerId]: role,
      }
    }

    room.players = setRoleList(room.players, playerId, role)
    emitRoomState(cleanRoomId)

    // Testing helper: if roles are adjusted mid-game, re-send private roles
    // so clients immediately reflect the current assignment.
    if (room.gameStarted) {
      emitPrivateRolesToRoom(cleanRoomId)
    }
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
    socket: MafiaServerSocket,
    roomId: string,
    payload: Pick<SubmitRoleActionPayload, "kind" | "targetClientId">
  ) => {
    const cleanRoomId = normalizeRoomId(roomId)
    const room = rooms[cleanRoomId]
    if (!room) {
      socket.emit("actionRefused", { reason: "Room does not exist." })
      return
    }

    if (room.roomType === "ROLE_SELECTOR") {
      socket.emit("actionRefused", {
        reason: "Role selector rooms do not support gameplay actions.",
      })
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
      const sheriffAllowedPhase =
        phase === "DAY" || phase === "DISCUSSION" || phase === "PUBDISCUSSION"
      if (!sheriffAllowedPhase) {
        return refuse("Sheriff can only shoot during DAY and DISCUSSION phases.")
      }
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

    // Detective checks resolve immediately so the detective sees
    // the result popup right after clicking investigate.
    if (kind === "DETECTIVE_CHECK") {
      socket.emit("actionAccepted", { kind, targetClientId })

      if (!isSkipAction && target) {
        socket.emit("privateMessage", {
          roomId: cleanRoomId,
          gameNumber: room.gameNumber,
          type: "DETECTIVE_RESULT",
          toClientId: fromClientId,
          checkedClientId: target.clientId,
          isMafia: target.role === "MAFIA",
        })
      }

      return
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

    // Sheriff shots resolve immediately so players get direct feedback
    // during DAY / DISCUSSION / PUBDISCUSSION.
    if (kind === "SHERIFF_SHOOT") {
      applySheriffResolution(room, cleanRoomId)
      if (maybeEndGameFromAliveState(room, cleanRoomId)) return
      emitRoomState(cleanRoomId)
      return
    }

    // If everyone has submitted a vote, skip remaining timer and resolve now.
    if (kind === "CIVILIAN_VOTE" && allEligibleVotersSubmitted(room, cleanRoomId)) {
      finalizeVotingPhase(room, cleanRoomId)
    }
  }


  /* ------------------------------------------------------
            Helper: re-send my private role (private)
    - Replays "yourRole" to requesting socket only
    - Fixes race where client enters Game screen after initial
      role emit and would otherwise show "(unknown)"
  ------------------------------------------------------ */

  const requestMyRoleLocal = (socket: MafiaServerSocket, roomId: string) => {
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
    addBotLocal,
    setHostParticipationLocal,
    setPlayerAlive,
    setPlayerRole,
    setPlayerStatus,
    updateRoomSettings,
    updateRoleSelectorSettingsLocal,
    importBotcScriptLocal,
    handleReconnect,
    startGameLocal,
    skipPhaseLocal,
    redealRoleSelectorLocal,
    kickPlayerLocal,
    submitRoleActionLocal,
    requestMyRoleLocal,
  }
}

