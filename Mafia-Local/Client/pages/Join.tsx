import React, { useEffect, useMemo, useState } from "react"
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

export type JoinMode = "PLAY_GAME" | "ROLE_ASSIGNER"

type Props = {
  mode: JoinMode
  onBackToMenu: () => void
  onEnterLobby: (
    roomId: string,
    playerName: string,
    joinUrl: string,
    qrDataUrl: string
  ) => void
}

export default function Join({ mode, onBackToMenu, onEnterLobby }: Props) {
  const [name, setName] = useState("")
  const [room, setRoom] = useState("")
  const [status, setStatus] = useState("")
  const [pendingRoom, setPendingRoom] = useState("")

  const isRoleAssignerMode = mode === "ROLE_ASSIGNER"

  const validRoomCode = ROOM_CODE_REGEX.test(normalizeRoomId(room))
  const validName = name.trim().length > 0

  const baseUrl = useMemo(() => window.location.origin, [])

  const cleanName = name.trim()
  const cleanRoom = normalizeRoomId(room)

  useEffect(() => {
    const onConnect = () => {
      setStatus(`Connected to server with ID: ${socket.id}`)
    }

    const onDisconnect = (reason: string) => {
      setStatus(`Disconnected from server: ${reason}`)
    }

    const onReconnected = ({ roomId, playerName }: ReconnectedPayload) => {
      setStatus(`Reconnected to room ${roomId} as ${playerName}`)

      // Lobby auto-emits joinRoom on mount; during reconnect the server already reattached us.
      window.sessionStorage.setItem("mafia_skip_lobby_autojoin", "1")

      onEnterLobby(roomId, playerName, "", "")
    }

    const onConnectError = (error: Error) => {
      setStatus(`Connection error: ${error.message}`)
    }

    const onRoomCreated = ({ roomId, joinUrl, qrDataUrl }: RoomCreatedPayload) => {
      setRoom(roomId)
      setStatus(`Room created! Share this code to join: ${roomId}`)

      // The server already joined this socket; move UI to lobby.
      onEnterLobby(roomId, name.trim(), joinUrl, qrDataUrl)
    }

    const onRoomState = (s: RoomState) => {
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

    // If someone lands here with ?room=XXXX, prefill it.
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
  }, [cleanName, name, onEnterLobby, pendingRoom])

  const createRoomForMode = () => {
    if (!cleanName) return alert("Enter Name First!")

    const roomType = isRoleAssignerMode ? "ROLE_SELECTOR" : "CLASSIC"

    setStatus(isRoleAssignerMode ? "Creating role assigner room..." : "Creating room...")

    socket.emit("createRoom", {
      playerName: cleanName,
      baseUrl,
      roomType,
    })
  }

  const joinRoom = () => {
    if (!cleanName || !cleanRoom) {
      setStatus("Enter Name and Room Code First!")
      return
    }

    setStatus(`Joining room ${cleanRoom}...`)
    setPendingRoom(cleanRoom)

    socket.emit("joinRoom", {
      roomId: cleanRoom,
      playerName: cleanName,
      expectedRoomType: isRoleAssignerMode ? "ROLE_SELECTOR" : "CLASSIC",
    })
  }

  const title = isRoleAssignerMode ? "Role Assigner" : "Mafia"
  const subtitle = isRoleAssignerMode
    ? "Create or join a role assignment room."
    : "The classic party game, now online!"
  const cardTitle = isRoleAssignerMode
    ? "Join or Create a Role Assigner Room"
    : "Join or Create a Game"
  const createLabel = isRoleAssignerMode
    ? "Create Role Assigner Room"
    : "Create New Room"

  return (
    <div className="join-page">
      <header className="join-topbar">
        <button
          type="button"
          className="join-top-action join-top-action-signup"
          onClick={onBackToMenu}
        >
          Back to Menu
        </button>

        <div className="join-brand">
          <img
            src="/assets/Mafia-Icon.png"
            alt="Mafia logo"
            className="join-brand-logo"
            onError={(event) => {
              event.currentTarget.style.display = "none"
            }}
          />
          <span className="join-brand-name">Mafia</span>
        </div>
      </header>

      <main className="join-main">
        <h1 className="join-title">{title}</h1>
        <p className="join-subtitle">{subtitle}</p>

        <section className="join-card">
          <h2 className="join-card-title">{cardTitle}</h2>
          <p className="join-card-copy">
            Enter a room code to join an existing room or create your own
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
            onClick={createRoomForMode}
          >
            {createLabel}
          </button>

          <p className="join-minimum">Minimum 4 players required to start a game</p>
        </section>

        {status ? <div className="join-status">{status}</div> : null}
      </main>

      <footer className="join-footer">
        (c) {new Date().getFullYear()} MafiaGame. All rights reserved.
      </footer>
    </div>
  )
}
