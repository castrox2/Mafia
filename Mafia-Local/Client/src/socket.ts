import { io, Socket } from "socket.io-client";

const protocol = window.location.protocol
const host = window.location.hostname

export const socket: Socket = io(`http://${host}:3000`, {
    transports: ["websocket", "polling"],
})
