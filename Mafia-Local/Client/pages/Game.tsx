import React, { useEffect, useMemo, useState, useRef } from "react"
import { socket, clientId } from "../src/socket.js"
import { PhaseRouter } from "../components/PhaseRouter.js"
import { PHASE_LABELS } from "../src/constants/phaseLabels.js"
import type { RoomState } from "../src/types.js"

type Props = {
    roomId: string
    playerName: string
    onExit: () => void
    onBackToLobby: () => void
}

type Winner = "MAFIA" | "CIVILIANS"
type ActionFeedback = null | { kind: "ACCEPTED" | "REFUSED"; text: string }

export default function Game({ roomId, playerName, onExit, onBackToLobby }: Props) {
    const [state, setState] = useState<RoomState | null>(null)

    const cleanRoomId = useMemo(() => roomId.trim().toUpperCase(), [roomId])
    const cleanPlayerName = useMemo(() => playerName.trim(), [playerName])

/* ------------------------------------------------------
        Local "now" clock for countdown UI
    - Keeps UI in sync without asking server repeatedly
------------------------------------------------------ */
    const [nowMs, setNowMs] = useState(Date.now())

    // Private role (anti-spoiler): set by server via "yourRole"
    const [myRole, setMyRole] = useState<string | null>(null)
    const [rolemateClientIds, setRolemateClientIds] = useState<string[]>([])

    // UI-friendly transient banners (night/vote summaries)
    const [banner, setBanner] = useState<null | { kind: "NIGHT" | "VOTING"; text: string }>(null)

    // Private messages (ex: Detective result). UI teammate can turn into toast/modal later.
    const [privateMessages, setPrivateMessages] = useState<any[]>([])

    // Optional: restore my current selections for a phase (from requestMyActions)
    const [myActions, setMyActions] = useState<any[]>([])

    // End-game winner (authoritative event from server)
    const [winner, setWinner] = useState<Winner | null>(null)

    // Short-lived action feedback ("accepted"/"refused")
    const [actionFeedback, setActionFeedback] = useState<ActionFeedback>(null)

    const bannerTimeoutRef = useRef<number | null>(null)
    const actionFeedbackTimeoutRef = useRef<number | null>(null)

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
        if (!s.gameStarted) {
            setRolemateClientIds([])
        }
        if (s.phase !== "GAMEOVER") {
            setWinner(null)
        }
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

    const onStartRefused = ({ reason }: { reason: string }) => {
        alert(reason || "Unable to start a new game.")
    }



    socket.on("roomState", onRoomState)
    socket.on("roomClosed", onRoomClosed)
    socket.on("kicked", onKicked)
    socket.on("startRefused", onStartRefused)

    // Ask server to re-send the current state (safe: does not re-join)
    if (cleanRoomId) {
        socket.emit("requestRoomState", { roomId: cleanRoomId })
        socket.emit("requestMyRole", { roomId: cleanRoomId })
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
        socket.off("startRefused", onStartRefused)
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
        setMyActions([])
        socket.emit("requestMyRole", { roomId: cleanRoomId })
        socket.emit("requestMyActions", { roomId: cleanRoomId })
        console.log("phaseStarted", payload)
    }

    socket.on("phaseEnding", onPhaseEnding)
    socket.on("phaseStarted", onPhaseStarted)

    return () => {
        socket.off("phaseEnding", onPhaseEnding)
        socket.off("phaseStarted", onPhaseStarted)
    }
}, [cleanRoomId])

// ------------------------------------------------------
// Role reliability fallback
// - If game is running and role is still unknown, re-request once shortly.
// - Covers edge timing where Game mounts right after role emit.
// ------------------------------------------------------
useEffect(() => {
  if (!cleanRoomId) return
  if (state?.gameStarted !== true) return
  if (myRole != null) return

  const t = window.setTimeout(() => {
    socket.emit("requestMyRole", { roomId: cleanRoomId })
  }, 120)

  return () => window.clearTimeout(t)
}, [cleanRoomId, state?.gameStarted, myRole])

// ------------------------------------------------------
// Game event listeners (UI-friendly)
// - yourRole: private role reveal (only to this socket)
// - privateMessage: private info (ex: detective results)
// - nightSummary / voteSummary: public, spoiler-safe summaries
// - myActions: server echo of YOUR currently recorded action(s) for this phase
//
// Notes for UI teammate:
// - These are the best "hooks" for banners/toasts/modals.
// - They are *events*, not authoritative truth.
//   Authoritative truth is still roomState (players alive, phase, etc.)
// ------------------------------------------------------
useEffect(() => {
  const clearActionFeedbackTimer = () => {
    if (actionFeedbackTimeoutRef.current) {
      window.clearTimeout(actionFeedbackTimeoutRef.current)
      actionFeedbackTimeoutRef.current = null
    }
  }

  const showActionFeedback = (next: Exclude<ActionFeedback, null>) => {
    setActionFeedback(next)
    clearActionFeedbackTimer()
    actionFeedbackTimeoutRef.current = window.setTimeout(() => {
      setActionFeedback(null)
    }, 1500)
  }

  const onYourRole = (payload: {
    roomId: string
    gameNumber: number
    role: string
    rolemateClientIds?: string[]
  }) => {
    if (payload.roomId !== cleanRoomId) return

    // UI teammate idea:
    // - Show a one-time modal: "You are the Detective"
    // - Or show a small badge near the player name
    setMyRole(payload.role)
    setRolemateClientIds(Array.isArray(payload.rolemateClientIds) ? payload.rolemateClientIds : [])
    console.log("yourRole", payload)
  }

  const onPrivateMessage = (payload: any) => {
    // This event is already private by design, but still room-filter it.
    // (Good habit if you ever support multiple rooms per client.)
    if ((payload as any)?.roomId && (payload as any).roomId !== cleanRoomId) return

    // UI teammate idea:
    // - Show toast/modal
    // - Or add to an "Inbox" panel for the player
    setPrivateMessages((prev) => [...prev, payload])
    console.log("privateMessage", payload)
  }

  const onNightSummary = (payload: {
    roomId: string
    gameNumber: number
    someoneDied: boolean
  }) => {
    if (payload.roomId !== cleanRoomId) return

    // UI teammate idea:
    // - Show a full-screen overlay or banner for 1-2 seconds
    // - Fade out automatically
    setBanner({
        kind: "NIGHT",
        text: payload.someoneDied ? "Night ended: someone died." : "Night ended: no one died.",
    })

    if (bannerTimeoutRef.current) {
        window.clearTimeout(bannerTimeoutRef.current)
        }

        bannerTimeoutRef.current = window.setTimeout(() => {
        setBanner(null)
    }, 1500)

    console.log("nightSummary", payload)
  }

  const onVoteSummary = (payload: {
    roomId: string
    gameNumber: number
    someoneDied: boolean
  }) => {
    if (payload.roomId !== cleanRoomId) return

    setBanner({
      kind: "VOTING",
      text: payload.someoneDied ? "Voting ended: someone was eliminated." : "Voting ended: no one was eliminated.",
    })
    if (bannerTimeoutRef.current) {
        window.clearTimeout(bannerTimeoutRef.current)
        }

        bannerTimeoutRef.current = window.setTimeout(() => {
        setBanner(null)
    }, 1500)

    console.log("voteSummary", payload)
  }

  const onGameOver = (payload: {
    roomId: string
    gameNumber: number
    winner: Winner
  }) => {
    if (payload.roomId !== cleanRoomId) return

    setWinner(payload.winner)
    console.log("gameOver", payload)
  }

  const onActionAccepted = (payload: { kind: string; targetClientId: string }) => {
    const actionKind = String(payload?.kind || "ACTION").replaceAll("_", " ")
    showActionFeedback({
      kind: "ACCEPTED",
      text: `${actionKind} recorded.`,
    })
    console.log("actionAccepted", payload)
  }

  const onActionRefused = (payload: { kind?: string; reason: string }) => {
    const reason = String(payload?.reason || "Action was refused.")
    showActionFeedback({
      kind: "REFUSED",
      text: reason,
    })
    console.log("actionRefused", payload)
  }

  const onMyActions = (payload: {
    roomId: string
    gameNumber: number
    phase: string
    bucket: string
    actions: Array<{ kind: string; targetClientId: string; createdAtMs: number }>
  }) => {
    if (payload.roomId !== cleanRoomId) return

    // UI teammate idea:
    // - Pre-select buttons/radios based on existing action
    // - Show "You selected X" status
    setMyActions(payload.actions ?? [])
    console.log("myActions", payload)
  }

  socket.on("yourRole", onYourRole)
  socket.on("privateMessage", onPrivateMessage)
  socket.on("nightSummary", onNightSummary)
  socket.on("voteSummary", onVoteSummary)
  socket.on("gameOver", onGameOver)
  socket.on("actionAccepted", onActionAccepted)
  socket.on("actionRefused", onActionRefused)
  socket.on("myActions", onMyActions)

  // Re-request role AFTER listeners are attached to avoid missing
  // fast server responses during initial Game mount.
  socket.emit("requestMyRole", { roomId: cleanRoomId })

  return () => {
    if (bannerTimeoutRef.current) {
      window.clearTimeout(bannerTimeoutRef.current)
    }
    clearActionFeedbackTimer()

    socket.off("yourRole", onYourRole)
    socket.off("privateMessage", onPrivateMessage)
    socket.off("nightSummary", onNightSummary)
    socket.off("voteSummary", onVoteSummary)
    socket.off("gameOver", onGameOver)
    socket.off("actionAccepted", onActionAccepted)
    socket.off("actionRefused", onActionRefused)
    socket.off("myActions", onMyActions)
  }
}, [cleanRoomId])

    const isHost = state?.hostId === clientId
    const me = state?.players?.find((p) => p.clientId === clientId) ?? null
    const amSpectator = me?.isSpectator === true
    const isGameOverPhase = state?.phase === "GAMEOVER"

    const baseActionButtonStyle: React.CSSProperties = {
      padding: "10px 12px",
      fontSize: 16,
      borderRadius: 8,
      border: "1px solid #bdbdbd",
      background: "#fff",
      cursor: "pointer",
    }

    const leaveButtonStyle: React.CSSProperties = {
      ...baseActionButtonStyle,
      border: "1px solid #c47c7c",
      background: "#fff4f4",
    }

    const backToLobbyButtonStyle: React.CSSProperties = {
      ...baseActionButtonStyle,
      border: "1px solid #7ea0c4",
      background: "#f3f8ff",
    }

    const startNewGameButtonStyle: React.CSSProperties = {
      ...baseActionButtonStyle,
      border: "1px solid #5ea66d",
      background: "#f2fff4",
      opacity: isHost ? 1 : 0.65,
      cursor: isHost ? "pointer" : "not-allowed",
    }

    const leaveRoom = () => {
      socket.emit("leaveRoom", cleanRoomId)
      onExit()
    }

    const backToLobby = () => {
      // Important: moving from Game -> Lobby should not auto-emit joinRoom again.
      window.sessionStorage.setItem("mafia_skip_lobby_autojoin", "1")
      onBackToLobby()
    }

    const startNewGame = () => {
      if (!isHost) return
      socket.emit("forceStartGame", { roomId: cleanRoomId })
    }

    const submitRoleAction = (kind: string, targetClientId: string) => {
      socket.emit("submitRoleAction", { roomId: cleanRoomId, kind, targetClientId })
      socket.emit("requestMyActions", { roomId: cleanRoomId })
    }


    return (
    <div style={{ padding: 20, maxWidth: 900, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <img
            src="/assets/Mafia-Icon.png"
            alt="Mafia Local logo"
            style={{ width: 56, height: 56, objectFit: "contain" }}
            onError={(event) => {
                event.currentTarget.style.display = "none"
            }}
            />
            <h1 style={{ marginBottom: 0, marginTop: 0 }}>Game</h1>
        </div>

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
        {isGameOverPhase ? (
          <>
            <button style={leaveButtonStyle} onClick={leaveRoom}>
              Leave Room
            </button>
            <button style={backToLobbyButtonStyle} onClick={backToLobby}>
              Back to Lobby
            </button>
            <button
              style={startNewGameButtonStyle}
              onClick={startNewGame}
              disabled={!isHost}
              title={isHost ? "Start a fresh game immediately." : "Only the host can start a new game."}
            >
              Start New Game
            </button>
          </>
        ) : (
          <button style={leaveButtonStyle} onClick={leaveRoom}>
            Leave Room
          </button>
        )}
        </div>

      {/* Phase-specific screen (keeps styling/components isolated per phase) */}
        {state && (
            <PhaseRouter
                phase={state.phase}
                state={state}
                me={me}
                isHost={isHost}
                isSpectator={amSpectator}
                myRole={myRole}
                rolemateClientIds={rolemateClientIds}
                myActions={myActions}
                privateMessages={privateMessages}
                banner={banner}
                winner={winner}
                actionFeedback={actionFeedback}
                submitRoleAction={submitRoleAction}
            />
        )}

    </div>
    )
}


