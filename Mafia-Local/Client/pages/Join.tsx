import React, { useEffect, useState, useMemo } from "react"
import { socket } from "../src/socket.js"

type Props = {
    onEnterLobby: (roomId: string, playerName: string) => void
}

export default function Join({ onEnterLobby }: Props) {
    const [name, setName] = useState("")
    const [room, setRoom] = useState("")
    const [staatus, setStatus] = useState("")

    const baseUrll = useMemo(() => window.location.origin, [])

    useEffect(() => {
        const onConnect = () => (`Connected to server with ID: ${socket.id}`)
        const onDisconnect = (reason: string) => (`Disconnected from server: ${reason}`)
        const onConnectError = (error: Error) => (`Connection error: ${error.message}`)

        const onRoomCreated = ({ roomId }: { roomId: string }) => {
            // The server already joined; move UI to lobby
            onEnterLobby(roomId, name.trim())
        }

        socket.on("connect", onConnect)
        socket.on("disconnect", onDisconnect)
        socket.on("connect_error", onConnectError)
        socket.on("roomCreated", onRoomCreated)

        // If someone lands here with ?room=XXXX, prefill it
        const params = new URLSearchParams(window.location.search)
        const prefillRoom = (params.get("room") || "").trim().toUpperCase()
        if (prefillRoom) setRoom(prefillRoom)
        
        return () => {
            socket.off("connect", onConnect)
            socket.off("disconnect", onDisconnect)
            socket.off("connect_error", onConnectError)
            socket.off("roomCreated", onRoomCreated)
        }
    }, [onEnterLobby, name])

    const cleanName = name.trim()
    const cleanRoom = room.trim().toUpperCase()

    const createRoom = () => {
        if (!cleanName) return alert("Enter Name First!")
        setStatus("Creating room...")
        socket.emit("createRoom", { playerName: cleanName, baseUrl: baseUrll })
    }

    const joinRoom = () => {
        if (!cleanName || !cleanRoom) return alert("Enter Name and Room Code First!")
        setStatus(`Joining room ${cleanRoom}...`)
        socket.emit("joinRoom", { roomId: cleanRoom, playerName: cleanName })
        onEnterLobby(cleanRoom, cleanName)
    }

    return (
        <div style={{ padding: 20, maxWidth: 560, fontFamily: "sans-serif" }}>
        <h1 style={{ marginBottom: 8 }}>Mafia Local – Join</h1>
        <p style={{ marginTop: 0 }}>Create a room or join an existing room code.</p>

        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <input
            style={{ flex: 1, padding: 10, fontSize: 16 }}
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            />
            <input
            style={{ width: 160, padding: 10, fontSize: 16 }}
            placeholder="Room code"
            value={room}
            onChange={(e) => setRoom(e.target.value.toUpperCase())}
            />
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <button style={{ padding: "10px 12px", fontSize: 16 }} onClick={createRoom}>
            Create Room
            </button>
            <button style={{ padding: "10px 12px", fontSize: 16 }} onClick={joinRoom}>
            Join Room
            </button>
        </div>

        <div style={{ fontWeight: 700, whiteSpace: "pre-wrap" }}>{status}</div>
        </div>
    )
}