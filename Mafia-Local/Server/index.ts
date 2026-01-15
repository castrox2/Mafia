import express from "express"
import http from "http"
import { Server as SocketIOServer } from "socket.io"

const app = express()
const server = http.createServer(app)

const io = new SocketIOServer(server, {
  cors: { origin: "*" }
})

// serve a basic page (for now)
app.get("/", (req, res) => {
  res.send("<h1>Mafia Local Server Running ✅</h1>")
})

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id)
})

server.listen(3000, () => {
  console.log("Server listening on http://localhost:3000")
})
