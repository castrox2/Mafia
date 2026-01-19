import { io, Socket } from "socket.io-client";

const host = window.location.hostname
export const socket: Socket = io("http://localhost:3000", {
    transports: ["websocket", "polling"],
})
