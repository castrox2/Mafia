import React, { useEffect, useState, useMemo } from "react"
import { socket } from "../src/socket.js"
import type { RoomState } from "../src/types.js"
import {
  ROOM_CODE_LENGTH,
  ROOM_CODE_REGEX,
  normalizeRoomId,
} from "../../Shared/events.js"
import type {
  ReasonPayload,
  ReconnectedPayload,
  RoomCreatedPayload,
  RoomIdPayload,
} from "../../Shared/events.js"

export type JoinMode = "PLAY_GAME" | "ROLE_ASSIGNER"

type Props = {
    mode: JoinMode
    onBackToMenu: () => void
    onEnterLobby: (roomId: string, playerName: string, joinUrl: string, qrDataUrl: string) => void
}

export default function Join({ mode, onBackToMenu, onEnterLobby }: Props) {
    const [name, setName] = useState("")
    const [room, setRoom] = useState("")
    const [status, setStatus] = useState("")
    const [pendingRoom, setPendingRoom] = useState("")

    const validRoomCode = ROOM_CODE_REGEX.test(normalizeRoomId(room))
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

        const onReconnected = ({ roomId, playerName }: ReconnectedPayload) => {
            setStatus(`Reconnected to room ${roomId} as ${playerName}`)

            // IMPORTANT (reconnect-safe):
            // Lobby auto-emits joinRoom on mount; during reconnect the server already reattached us.
            // Set a one-time flag so Lobby can skip the auto-join emit.
            window.sessionStorage.setItem("mafia_skip_lobby_autojoin", "1")

            onEnterLobby(roomId, playerName, "", "")
        }


        const onConnectError = (error: Error) => {
            console.log(`Connection error: ${error.message}`)
            setStatus(`Connection error: ${error.message}`)
        }

        const onRoomCreated = ({ roomId, joinUrl, qrDataUrl }: RoomCreatedPayload) => {
            setRoom(roomId)
            setStatus(`Room created! Share this code to join: ${roomId}`)

            // The server already joined; move UI to lobby
            onEnterLobby(roomId, name.trim(), joinUrl, qrDataUrl)
        }

        const onRoomState = (s: RoomState) => {

            // Only proceeds of we're attempting to join this room
            if (!pendingRoom) return
            if (s.roomId !== pendingRoom) return

            setPendingRoom("")
            onEnterLobby(s.roomId, cleanName, "", "")
        }

        const onRoomNotFound = ({ roomId }: RoomIdPayload) => {
            setStatus(`Room ${roomId} not found.`)
        }

        const onRoomInvalid = ({ reason }: ReasonPayload) => {
            setPendingRoom("")
            setStatus(reason)
        }

        
        socket.on("connect", onConnect)
        socket.on("disconnect", onDisconnect)
        socket.on("reconnected", onReconnected)
        socket.on("connect_error", onConnectError)
        socket.on("roomCreated", onRoomCreated)
        socket.on("roomState", onRoomState)
        socket.on("roomNotFound", onRoomNotFound)
        socket.on("roomInvalid", onRoomInvalid)

        // If someone lands here with ?room=XXXX, prefill it
        const params = new URLSearchParams(window.location.search)
        const prefillRoom = normalizeRoomId(params.get("room") || "")
        if (prefillRoom) setRoom(prefillRoom)
        
        return () => {
            socket.off("connect", onConnect)
            socket.off("disconnect", onDisconnect)
            socket.off("reconnected", onReconnected)
            socket.off("connect_error", onConnectError)
            socket.off("roomCreated", onRoomCreated)
            socket.off("roomState", onRoomState)
            socket.off("roomNotFound", onRoomNotFound)
            socket.off("roomInvalid", onRoomInvalid)
        }
    }, [onEnterLobby, name, pendingRoom])

    const cleanName = name.trim()
    const cleanRoom = normalizeRoomId(room)

    const createRoom = () => {
        if (!cleanName) return alert("Enter Name First!")
        setStatus("Creating room...")
        socket.emit("createRoom", { playerName: cleanName, baseUrl: baseUrll })
    }

    const createRoleSelectorRoom = () => {
        if (!cleanName) return alert("Enter Name First!")
        setStatus("Creating role selector room...")
        socket.emit("createRoom", {
            playerName: cleanName,
            baseUrl: baseUrll,
            roomType: "ROLE_SELECTOR",
        })
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

    const isRoleAssignerMode = mode === "ROLE_ASSIGNER"
    const title = isRoleAssignerMode
      ? "Mafia - Role Assigner"
      : "Mafia - Play Game"
    const subtitle = isRoleAssignerMode
      ? "Create or join a role assignment room."
      : "Create a classic room or join an existing room."

    return (
        <div style={{ padding: 20, maxWidth: 560, fontFamily: "sans-serif" }}>
        <div style={{ marginBottom: 10 }}>
            <button
              type="button"
              onClick={onBackToMenu}
              style={{
                padding: "8px 10px",
                fontSize: 14,
                borderRadius: 8,
                border: "1px solid #cbd1da",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Back to Menu
            </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <img
            src="/assets/Mafia-Icon.png"
            alt="Mafia logo"
            style={{ width: 72, height: 72, objectFit: "contain" }}
            onError={(event) => {
                event.currentTarget.style.display = "none"
            }}
            />
            <div>
            <h1 style={{ marginBottom: 8, marginTop: 0 }}>{title}</h1>
            <p style={{ marginTop: 0 }}>{subtitle}</p>
            </div>
        </div>

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
            onChange={(e) =>
              setRoom(normalizeRoomId(e.target.value).slice(0, ROOM_CODE_LENGTH))
            }
            maxLength={ROOM_CODE_LENGTH}
            />
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            {isRoleAssignerMode ? (
              <button style={{ padding: "10px 12px", fontSize: 16 }} onClick={createRoleSelectorRoom}>
                Create Role Assigner Room
              </button>
            ) : (
              <button style={{ padding: "10px 12px", fontSize: 16 }} onClick={createRoom}>
                Create Room
              </button>
            )}
            <button style={{ padding: "10px 12px", fontSize: 16 }} disabled={!validRoomCode || !validName} onClick={joinRoom}>
            Join Room
            </button>
        </div>

        <div style={{ fontWeight: 700, whiteSpace: "pre-wrap" }}>{status}</div>
        </div>
    )
}
