import React, { useEffect, useState, useMemo } from "react"
import { socket } from "../src/socket.js"
import type { RoomState } from "../src/types.js"
import "../src/styles/pages/join.css"
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

type Props = {
    onEnterLobby: (roomId: string, playerName: string, joinUrl: string, qrDataUrl: string) => void
}

export default function Join({ onEnterLobby }: Props) {
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

    return (
      <div className="join-page">
        <header className="join-topbar">
          <div className="join-brand">
            <img
              src="/assets/Mafia-Icon.png"
              alt="Mafia logo"
              className="join-brand-logo"
              onError={(event) => {
                event.currentTarget.style.display = "none"
              }}
            />
            <span className="join-brand-name">MafiaGame</span>
          </div>
          <div className="join-top-actions">
            <button type="button" className="join-top-action">Login</button>
            <button type="button" className="join-top-action join-top-action-signup">
              Sign up
            </button>
          </div>
        </header>

        <main className="join-main">
          <h1 className="join-title">Mafia</h1>
          <p className="join-subtitle">The classic party game, now online!</p>

          <section className="join-card">
            <h2 className="join-card-title">Join or Create a Game</h2>
            <p className="join-card-copy">
              Enter a room code to join an existing game or create your own
            </p>

            <input
              className="join-input"
              placeholder="ENTER YOUR NAME"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              className="join-input"
              placeholder="ENTER ROOM CODE (E.G., A2B4C)"
              value={room}
              onChange={(e) =>
                setRoom(normalizeRoomId(e.target.value).slice(0, ROOM_CODE_LENGTH))
              }
              maxLength={ROOM_CODE_LENGTH}
            />

            <button
              type="button"
              className="join-button join-button-secondary"
              disabled={!validRoomCode || !validName}
              onClick={joinRoom}
            >
              <img
                src="/assets/Mafia-Icon.png"
                alt=""
                className="join-button-icon"
                aria-hidden="true"
                onError={(event) => {
                  event.currentTarget.style.display = "none"
                }}
              />
              <span>Join Room</span>
            </button>

            <div className="join-divider" aria-hidden="true">
              <span>OR</span>
            </div>

            <button
              type="button"
              className="join-button join-button-primary"
              onClick={createRoom}
            >
              Create New Room
            </button>

            <p className="join-minimum">Minimum 4 players required to start a game</p>

            <button
              type="button"
              className="join-role-selector"
              onClick={createRoleSelectorRoom}
            >
              Create Role Selector Room
            </button>
          </section>

          {status ? <div className="join-status">{status}</div> : null}
        </main>

        <footer className="join-footer">
          (c) {new Date().getFullYear()} MafiaGame. All rights reserved.
        </footer>
      </div>
    )
}
