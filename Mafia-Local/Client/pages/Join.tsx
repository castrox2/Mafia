import React, { useEffect, useState, useMemo } from "react"
import { socket } from "../src/socket.js"

type Props = {
    onEnterLobby: (roomId: string, playerName: string, joinUrl: string, qrDataUrl: string) => void
}

export default function Join({ onEnterLobby }: Props) {
    const [name, setName] = useState("")
    const [room, setRoom] = useState("")
    const [status, setStatus] = useState("")
    const [qrDataUrl, setQrDataUrl] = useState("")
    const [join, setJoinUrl] = useState("")
    const [pendingRoom, setPendingRoom] = useState("")

    const validRoomCode = /^[A-Z0-9]{5}$/.test(room.trim())
    const validName = name.trim().length > 0

    const baseUrll = useMemo(() => window.location.origin, [])

    useEffect(() => {
        const onConnect = () => {
            console.log(`Connected to server with ID: ${socket.id}`)
            setStatus(`Connected to server with ID: ${socket.id}`)
        }

        const onDisconnect = (reason: string) => {
            console.log(`Disconnected from server: ${reason}`)
            setStatus(`Disconnected from server: ${reason}`)
        }

        const onReconnected = ({ roomId, playerName }: { roomId: string, playerName: string }) => {
            setStatus(`Reconnected to room ${roomId} as ${playerName}`)
            onEnterLobby(roomId, playerName, "", "")
        }

        const onConnectError = (error: Error) => {
            console.log(`Connection error: ${error.message}`)
            setStatus(`Connection error: ${error.message}`)
        }

        const onRoomCreated = ({ roomId, joinUrl, qrDataUrl }: { roomId: string, joinUrl: string, qrDataUrl: string }) => {
            setRoom(roomId)
            setJoinUrl(joinUrl)
            setQrDataUrl(qrDataUrl)
            setStatus(`Room created! Share this code to join: ${roomId}`)

            // The server already joined; move UI to lobby
            onEnterLobby(roomId, name.trim(), joinUrl, qrDataUrl)
        }

        const onRoomState = (s: any) => {

            // Only proceeds of we're attempting to join this room
            if (!pendingRoom) return
            if (s.roomId !== pendingRoom) return

            setPendingRoom("")
            onEnterLobby(s.roomId, cleanName, "", "")
        }

        const onRoomNotFound = ({ roomId }: { roomId: string }) => {
            setStatus(`Room ${roomId} not found.`)
        }

        const onRoomInvalid = ({ reason }: { reason: string }) => {
            setPendingRoom("")
            setStatus(reason)
        }

        
        socket.on("connect", onConnect)
        socket.on("disconnect", onDisconnect)
        // socket.on("reconnected", onReconnected)
        socket.on("connect_error", onConnectError)
        socket.on("roomCreated", onRoomCreated)
        socket.on("roomState", onRoomState)
        socket.on("roomNotFound", onRoomNotFound)
        socket.on("roomInvalid", onRoomInvalid)

        // If someone lands here with ?room=XXXX, prefill it
        const params = new URLSearchParams(window.location.search)
        const prefillRoom = (params.get("room") || "").trim().toUpperCase()
        if (prefillRoom) setRoom(prefillRoom)
        
        return () => {
            socket.off("connect", onConnect)
            socket.off("disconnect", onDisconnect)
            // socket.off("reconnected", onReconnected)
            socket.off("connect_error", onConnectError)
            socket.off("roomCreated", onRoomCreated)
            socket.off("roomState", onRoomState)
            socket.off("roomNotFound", onRoomNotFound)
            socket.off("roomInvalid", onRoomInvalid)
        }
    }, [onEnterLobby, name, pendingRoom])

    const cleanName = name.trim()
    const cleanRoom = room.trim().toUpperCase()

    const createRoom = () => {
        if (!cleanName) return alert("Enter Name First!")
        setStatus("Creating room...")
        socket.emit("createRoom", { playerName: cleanName, baseUrl: baseUrll })
    }

    const joinRoom = () => {
        if (!cleanName || !cleanRoom) {
            setStatus("Enter Name and Room Code First!")
            return
        }
        
        setStatus(`Joining room ${cleanRoom}...`)

        // Mark which room to join
        setPendingRoom(cleanRoom)

        // ask the SERVER to join (server accepts or rejects)
        socket.emit("joinRoom", { roomId: cleanRoom, playerName: cleanName })
    }

    return (
        <div style={{ padding: 20, maxWidth: 560, fontFamily: "sans-serif" }}>
        <h1 style={{ marginBottom: 8 }}>Mafia Local – Join</h1>
        <p style={{ marginTop: 0 }}>Create a room or join an existing room!</p>

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
            maxLength={5}
            />
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <button style={{ padding: "10px 12px", fontSize: 16 }} onClick={createRoom}>
            Create Room
            </button>
            <button style={{ padding: "10px 12px", fontSize: 16 }} disabled={!validRoomCode || !validName} onClick={joinRoom}>
            Join Room
            </button>
        </div>

        <div style={{ fontWeight: 700, whiteSpace: "pre-wrap" }}>{status}</div>
        </div>
    )
}