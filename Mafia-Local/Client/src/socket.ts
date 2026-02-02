import { io, type Socket } from "socket.io-client"

export type ReconnectedPayload = {
    roomId: string
    playerName: string
}

// Stable identity rules:
// - deviceId: persists across browser restarts (localStorage)
// - sessionId: unique per tab/window, persists across refresh (sessionStorage)
// This prevents "two tabs become one player" while keeping reconnect stable.
const DEVICE_KEY = "mafia_device_id"
const SESSION_KEY = "mafia_session_id"
const LEGACY_KEY = "mafia_client_id" // from older builds

const makeId = (): string => {
    return (typeof crypto !== "undefined" &&
    "randomUUID" in crypto &&
    typeof crypto.randomUUID === "function")
    ? crypto.randomUUID()
    : `id_${Math.random().toString(16).slice(2)}_${Date.now()}`
}

const getOrCreateDeviceId = (): string => {
    const existing = window.localStorage.getItem(DEVICE_KEY)
    if (existing) return existing

  // Migrate legacy id if it exists (keeps existing installs stable)
    const legacy = window.localStorage.getItem(LEGACY_KEY)
    const next = legacy || makeId()

    window.localStorage.setItem(DEVICE_KEY, next)

    // Remove legacy key if it existed
    if (legacy) {
        window.localStorage.removeItem(LEGACY_KEY)
    }
    
    return next
}

const getOrCreateSessionId = (): string => {
    const existing = window.sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing

    const next = makeId()
    window.sessionStorage.setItem(SESSION_KEY, next)
    return next
}

const getOrCreateClientId = (): string => {
    const deviceId = getOrCreateDeviceId()
    const sessionId = getOrCreateSessionId()
    return `${deviceId}:${sessionId}`
}


export const clientId = getOrCreateClientId()

// IMPOERTANT: Socket.IO is on port 3000 but vite is on 5173
const SERVER_URL = `http://${window.location.hostname}:3000`

export const socket: Socket = io(SERVER_URL, {
  // IMPORTANT: this is how the server knows who you "really" are (even after reconnect)
    auth: { clientId },
    transports: ["websocket", "polling"],
})

/* ------------------------------------------------------
            Buffered "reconnected" event
- Prevents missing the event if server emits immediately
------------------------------------------------------ */

let lastReconnected: ReconnectedPayload | null = null
let reconnectedHandlers = new Set<(p: ReconnectedPayload) => void>()

socket.on("reconnected", (p: ReconnectedPayload) => {
    lastReconnected = p
    for (const h of reconnectedHandlers) h(p)
})

export const onReconnected = (handler: (p: ReconnectedPayload) => void) => {
    reconnectedHandlers.add(handler)

  // If reconnect already happened before React mounted, deliver it immediately
    if (lastReconnected) handler(lastReconnected)

    return () => {
        reconnectedHandlers.delete(handler)
    }
}
