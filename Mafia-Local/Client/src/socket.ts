import { io, type Socket } from "socket.io-client"

// Stable clientId (persists across refresh / reconnect)
const STORAGE_KEY = "mafia_client_id"

const getOrCreateClientId = (): string => {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing) return existing

    const id =
    (typeof crypto !== "undefined" && "randomUUID" in crypto && crypto.randomUUID())
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
