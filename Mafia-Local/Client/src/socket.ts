import { io, type Socket } from "socket.io-client"

export type ReconnectedPayload = {
    roomId: string
    playerName: string
}

// Stable clientId (persists across refresh / reconnect)
const STORAGE_KEY = "mafia_client_id"

const getOrCreateClientId = (): string => {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing) return existing

    const id =
    (typeof crypto !== "undefined" &&
        "randomUUID" in crypto &&
        typeof crypto.randomUUID === "function" &&
        crypto.randomUUID())
        ? crypto.randomUUID()
        : `client_${Math.random().toString(16).slice(2)}_${Date.now()}`

    window.localStorage.setItem(STORAGE_KEY, id)
    return id
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
