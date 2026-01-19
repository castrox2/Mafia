import { io, Socket } from "socket.io-client";

const SERVER_URL = "http://localhost:3000";

export const socket: Socket = io(window.location.origin, {
    transports: ["websocket", "polling"],
})

