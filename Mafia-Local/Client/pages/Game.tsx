import React, { useEffect, useMemo, useState } from "react"
import { socket, clientId } from "../src/socket.js"
import type { RoomState } from "../src/types.js"

type Props = {
    roomId: string
    playerName: string
    onExit: () => void
}

export default function Game({ roomId, playerName, onExit }: Props) {
    const [state, setState] = useState<RoomState | null>(null)

    const cleanRoomId = useMemo(() => roomId.trim().toUpperCase(), [roomId])
    const cleanPlayerName = useMemo(() => playerName.trim(), [playerName])

/* ------------------------------------------------------
        Local "now" clock for countdown UI
    - Keeps UI in sync without asking server repeatedly
------------------------------------------------------ */
    const [nowMs, setNowMs] = useState(Date.now())

    useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 500)
    return () => clearInterval(t)
    }, [])

/* ------------------------------------------------------
        Countdown (derived)
    - phaseEndTime should be a server-provided epoch ms timestamp
------------------------------------------------------ */
    const remainingSec =
    state?.phaseEndTime != null
        ? Math.max(0, Math.ceil((state.phaseEndTime - nowMs) / 1000))
        : null

    useEffect(() => {
    const onRoomState = (s: RoomState) => {
        setState(s)
    }

    const onRoomClosed = ({ roomId: closedRoomId }: { roomId: string }) => {
        if (closedRoomId === cleanRoomId) {
        alert("Room was closed by the host.")
        onExit()
        }
    }

    const onKicked = ({ reason }: { reason: string }) => {
        alert(reason || "You were kicked.")
        onExit()
    }



    socket.on("roomState", onRoomState)
    socket.on("roomClosed", onRoomClosed)
    socket.on("kicked", onKicked)

    // Ask server to re-send the current state (safe: does not re-join)
    if (cleanRoomId) {
        socket.emit("requestRoomState", { roomId: cleanRoomId })
    }

    // IMPORTANT:
    // Do NOT auto-emit joinRoom here.
    // By the time we enter the Game screen, we are already in the socket.io room.
    // Auto-join here can reintroduce duplicate player entries.
    //
    // If you ever need to support "direct navigation to /game",
    // we can add a safe guarded join later.

    return () => {
        socket.off("roomState", onRoomState)
        socket.off("roomClosed", onRoomClosed)
        socket.off("kicked", onKicked)
    }
    }, [cleanRoomId, onExit])

    const leaveRoom = () => {
    socket.emit("leaveRoom", cleanRoomId)
    onExit()
    }

    const isHost = state?.hostId === clientId
    const me = state?.players?.find((p) => p.clientId === clientId) ?? null
    const amSpectator = me?.isSpectator === true


    return (
    <div style={{ padding: 20, maxWidth: 900, fontFamily: "sans-serif" }}>
        <h1 style={{ marginBottom: 8 }}>Game</h1>

        <div style={{ marginBottom: 10 }}>
        <div>
            <strong>Room:</strong> {cleanRoomId}
        </div>
        <div>
            <strong>You:</strong> {cleanPlayerName}
            {isHost ? " (HOST)" : ""}
            {amSpectator ? " (SPECTATOR)" : ""}
        </div>
        </div>

      {/* Game/Phase info (simple, easy to read) */}
        {state && (
        <div style={{ marginBottom: 12 }}>
            <div>
            <strong>Game:</strong>{" "}
            {state.gameStarted ? `Started (#${state.gameNumber})` : "Not started"}
            </div>
            <div>
            <strong>Phase:</strong> {state.phase}
            </div>
            {remainingSec !== null && (
            <div>
                <strong>Time left:</strong> {remainingSec}s
            </div>
            )}
        </div>
        )}

      {/* Minimal actions (no flashy UI) */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button style={{ padding: "10px 12px", fontSize: 16 }} onClick={leaveRoom}>
            Leave Room
        </button>
        </div>

      {/* Simple player list (still useful during development) */}
        {!amSpectator && (
            <>
                <h3>Players:</h3>
                <ul style={{ paddingLeft: 18 }}>
                {(state?.players ?? []).map((p) => {
                    const hostTag = p.clientId === state?.hostId ? " (HOST) " : ""
                    const deadTag = p.alive ? "" : " (dead)"
                    return (
                    <li key={p.clientId} style={{ marginBottom: 6 }}>
                        {p.name}
                        {hostTag}
                        {deadTag}
                        {" — "}
                        status: {p.status}
                    </li>
                    )
                })}
                </ul>
            </>
        )}
    </div>
    )
}
