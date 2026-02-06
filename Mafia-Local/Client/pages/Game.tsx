import React, { useEffect, useMemo, useState } from "react"
import { socket, clientId } from "../src/socket.js"
import { PhaseRouter } from "../components/phases/PhaseRouter.js"
import { PHASE_LABELS } from "../src/constants/phaseLabels.js"
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

// ------------------------------------------------------
// Phase transition listeners (UI-friendly)
// - phaseEnding: emitted ~500ms before the server switches phases
//   -> UI can start EXIT animations here (fade out, slide away, etc.)
// - phaseStarted: emitted when the server has entered the new phase
//   -> UI can swap to the new phase screen + start ENTER animations
//
// Notes for UI teammate:
// - Do NOT rely on local timers for authoritative phase changes.
// - Use roomState.phase / phaseStarted as the source of truth.
// - phaseEnding is only a hint to start animations early.
// ------------------------------------------------------

useEffect(() => {
    const onPhaseEnding = (payload: {
        roomId: string
        gameNumber: number
        fromPhase: string
        toPhase: string
        leadMs: number
    }) => {
        // Ignore events for other rooms (important if you ever support multiple rooms)
        if (payload.roomId !== cleanRoomId) return

        // UI teammate idea:
        // 1) Set a local "isTransitioning" flag to true
        // 2) Set local "transitionDirection" or "toPhase" for animation variants
        // 3) Begin exit animation for current phase screen
        //
        // Example:
        // setTransition({ state: "exiting", toPhase: payload.toPhase })
        //
        // You do NOT change game state here. Server will do the actual switch.
        console.log("phaseEnding", payload)
    }

    const onPhaseStarted = (payload: {
        roomId: string
        gameNumber: number
        phase: string
        phaseEndTime: number | null
    }) => {
        if (payload.roomId !== cleanRoomId) return

        // UI teammate idea:
        // 1) Swap rendered phase screen (if not already swapped by roomState)
        // 2) Start enter animation for the new phase screen
        // 3) Clear any per-phase UI selections (or requestMyActions to restore)
        //
        // Example:
        // setTransition({ state: "entering", phase: payload.phase })
        //
        // Countdown should still be derived from roomState.phaseEndTime for accuracy.
        console.log("phaseStarted", payload)
    }

    socket.on("phaseEnding", onPhaseEnding)
    socket.on("phaseStarted", onPhaseStarted)

    return () => {
        socket.off("phaseEnding", onPhaseEnding)
        socket.off("phaseStarted", onPhaseStarted)
    }
}, [cleanRoomId])


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

      {/* Phase-specific screen (keeps styling/components isolated per phase) */}
        {state && (
            <PhaseRouter
            phase={state.phase}
            state={state}
            me={me}
            isHost={isHost}
            isSpectator={amSpectator}
            />
        )}

    </div>
    )
}
