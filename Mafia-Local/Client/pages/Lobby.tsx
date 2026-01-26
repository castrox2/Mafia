import React, { useEffect, useMemo, useState } from "react"
import { socket } from "../src/socket.js"
import type { RoomState } from "../src/types.js"

type Props = {
    roomId: string
    playerName: string
    joinUrl: string
    qrDataUrl: string
    onExit: () => void
}

export default function Lobby({ roomId, playerName, joinUrl, qrDataUrl, onExit }: Props) {
    const [state, setState] = useState<RoomState | null>(null)
    const [status, setStatus] = useState("")

    const cleanRoomId = useMemo(() => roomId.trim().toUpperCase(), [roomId])
    const cleanPlayerName = useMemo(() => playerName.trim(), [playerName])

    useEffect(() => {
        const onRoomState = (s: RoomState) => {
            setState(s)
            setStatus(`In room: ${s.roomId}${socket.id === s.hostId ? " (Host)" : "" }`)
        }

        const onRoomClosed = ({ roomId: closedRoomId }: { roomId: string }) => {
            if (closedRoomId === cleanRoomId) {
                alert("Room was closed by the host.")
                onExit()
            }
        }

        socket.on("roomState", onRoomState)
        socket.on("roomClosed", onRoomClosed)

        // If user navigates here directly, make sure we joined
        if (cleanRoomId && cleanPlayerName) {
            socket.emit("joinRoom", { roomId: cleanRoomId, playerName: cleanPlayerName })
        }

        return () => {
      socket.off("roomState", onRoomState)
      socket.off("roomClosed", onRoomClosed)
    }
  }, [cleanRoomId, cleanPlayerName, onExit])

  const leaveRoom = () => {
    socket.emit("leaveRoom", cleanRoomId)
    setState(null)
    onExit()
  }

  const setReady = (ready: boolean) => {
    socket.emit("setPlayerStatus", {
      roomId: cleanRoomId,
      playerId: socket.id,
      status: ready ? "READY" : "NOT READY",
    })
  }

  return (
    <div style={{ padding: 20, maxWidth: 700, fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>Lobby</h1>

      <div style={{ marginBottom: 10 }}>
        <div><strong>Room:</strong> {cleanRoomId}</div>
        <div><strong>You:</strong> {cleanPlayerName}</div>
      </div>

        {/* QR code for joining (handy for local play) */}
        {qrDataUrl && state?.hostId === socket.id && (
        <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Scan to join this room:
            </div>

            <img
            src={qrDataUrl}
            alt="Room QR Code"
            style={{ width: 220, height: 220 }}
            />

            {joinUrl && (
            <div style={{ marginTop: 6, fontSize: 12 }}>
                Link:{" "}
                <a href={joinUrl} target="_blank" rel="noreferrer">
                {joinUrl}
                </a>
            </div>
            )}
        </div>
        )}

      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <button style={{ padding: "10px 12px", fontSize: 16 }} onClick={() => setReady(true)}>
          Ready
        </button>
        <button style={{ padding: "10px 12px", fontSize: 16 }} onClick={() => setReady(false)}>
          Not Ready
        </button>
        <button style={{ padding: "10px 12px", fontSize: 16 }} onClick={leaveRoom}>
          Leave Room
        </button>
      </div>

      <div style={{ fontWeight: 700, whiteSpace: "pre-wrap", marginBottom: 12 }}>
        {status}
      </div>

      <h3>Players in room:</h3>

      <ul style={{ paddingLeft: 18 }}>
        {(state?.players ?? []).map((p) => {
          const hostTag = p.id === state?.hostId ? " (HOST) " : ""
          const deadTag = p.alive ? "" : " (dead)"
          return (
            <li key={p.id}>
              {p.name}
              {hostTag}
              {deadTag}
              {" — "}
              role: {p.role}
              {" — "}
              status: {p.status}
            </li>
          )
        })}
      </ul>
    </div>
  )
}