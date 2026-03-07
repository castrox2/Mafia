import React, { useEffect, useMemo, useState, useRef } from "react"
import { socket, clientId } from "../src/socket.js"
import { PhaseRouter } from "../components/PhaseRouter.js"
import type { RoomState } from "../src/types.js"
import { normalizeRoomId } from "../../Shared/events.js"
import "../src/styles/pages/game.css"
import type {
  ActionAcceptedPayload,
  ActionRefusedPayload,
  GameOverPayload,
  MafiaWinner,
  PhaseEndingPayload,
  PhaseStartedPayload,
  PrivateMessagePayload,
  ReasonPayload,
  RoomIdPayload,
  RoleActionKind,
  RoundSummaryPayload,
  YourRolePayload,
} from "../../Shared/events.js"
import {
  getActionRecordedLabel,
  getNightSummaryLabel,
  getPhaseLabel,
  getRoleLabel,
} from "../src/uiMeta.js"

type Props = {
    roomId: string
    playerName: string
    onExit: () => void
    onBackToLobby: () => void
}

type Winner = MafiaWinner
type ActionFeedback = null | { kind: "ACCEPTED" | "REFUSED"; text: string }

export default function Game({ roomId, playerName, onExit, onBackToLobby }: Props) {
    const [state, setState] = useState<RoomState | null>(null)

    const cleanRoomId = useMemo(() => normalizeRoomId(roomId), [roomId])
    const cleanPlayerName = useMemo(() => playerName.trim(), [playerName])

/* ------------------------------------------------------
        Local "now" clock for countdown UI
    - Keeps UI in sync without asking server repeatedly
------------------------------------------------------ */
    const [nowMs, setNowMs] = useState(Date.now())

    // Private role (anti-spoiler): set by server via "yourRole"
    const [myRole, setMyRole] = useState<YourRolePayload["role"] | null>(null)
    const [rolemateClientIds, setRolemateClientIds] = useState<string[]>([])

    // UI-friendly transient banners (night/vote summaries)
    const [banner, setBanner] = useState<null | { kind: "NIGHT" | "VOTING"; text: string }>(null)

    // Private messages (ex: Detective result). UI teammate can turn into toast/modal later.
    const [privateMessages, setPrivateMessages] = useState<PrivateMessagePayload[]>([])

    // End-game winner (authoritative event from server)
    const [winner, setWinner] = useState<Winner | null>(null)

    // Short-lived action feedback ("accepted"/"refused")
    const [actionFeedback, setActionFeedback] = useState<ActionFeedback>(null)
    const [showRoleWhilePressed, setShowRoleWhilePressed] = useState(false)
    const [quickMenuOpen, setQuickMenuOpen] = useState(false)

    const bannerTimeoutRef = useRef<number | null>(null)
    const actionFeedbackTimeoutRef = useRef<number | null>(null)
    const quickMenuRef = useRef<HTMLDivElement | null>(null)

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

    const onRoomClosed = ({ roomId: closedRoomId }: RoomIdPayload) => {
        if (closedRoomId === cleanRoomId) {
        alert("Room was closed by the host.")
        onExit()
        }
    }

    const onKicked = ({ reason }: ReasonPayload & RoomIdPayload) => {
        alert(reason || "You were kicked.")
        onExit()
    }

    const onStartRefused = ({ reason }: ReasonPayload) => {
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
    const onPhaseEnding = (payload: PhaseEndingPayload) => {
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

    const onPhaseStarted = (payload: PhaseStartedPayload) => {
        if (payload.roomId !== cleanRoomId) return

        // UI teammate idea:
        // 1) Swap rendered phase screen (if not already swapped by roomState)
        // 2) Start enter animation for the new phase screen
        // 3) Clear any per-phase UI selections
        //
        // Example:
        // setTransition({ state: "entering", phase: payload.phase })
        //
        // Countdown should still be derived from roomState.phaseEndTime for accuracy.
        socket.emit("requestMyRole", { roomId: cleanRoomId })
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

  const onYourRole = (payload: YourRolePayload) => {
    if (payload.roomId !== cleanRoomId) return

    // UI teammate idea:
    // - Show a one-time modal: "You are the Detective"
    // - Or show a small badge near the player name
    setMyRole(payload.role)
    setRolemateClientIds(Array.isArray(payload.rolemateClientIds) ? payload.rolemateClientIds : [])
    console.log("yourRole", payload)
  }

  const onPrivateMessage = (payload: PrivateMessagePayload) => {
    // This event is already private by design, but still room-filter it.
    // (Good habit if you ever support multiple rooms per client.)
    if (payload.roomId !== cleanRoomId) return

    // UI teammate idea:
    // - Show toast/modal
    // - Or add to an "Inbox" panel for the player
    setPrivateMessages((prev) => [...prev, payload])
    console.log("privateMessage", payload)
  }

  const onNightSummary = (payload: RoundSummaryPayload) => {
    if (payload.roomId !== cleanRoomId) return

    // UI teammate idea:
    // - Show a full-screen overlay or banner for 1-2 seconds
    // - Fade out automatically
    // - Use payload.killedPlayerName for richer copy/cards if someoneDied=true
    setBanner({
        kind: "NIGHT",
        text: getNightSummaryLabel(payload),
    })

    if (bannerTimeoutRef.current) {
        window.clearTimeout(bannerTimeoutRef.current)
        }

        bannerTimeoutRef.current = window.setTimeout(() => {
        setBanner(null)
    }, 1500)

    console.log("nightSummary", payload)
  }

  const onVoteSummary = (payload: RoundSummaryPayload) => {
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

  const onGameOver = (payload: GameOverPayload) => {
    if (payload.roomId !== cleanRoomId) return

    setWinner(payload.winner)
    console.log("gameOver", payload)
  }

  const onActionAccepted = (payload: ActionAcceptedPayload) => {
    const actionKind = getActionRecordedLabel(String(payload?.kind || "ACTION"))
    showActionFeedback({
      kind: "ACCEPTED",
      text: `${actionKind} recorded.`,
    })
    console.log("actionAccepted", payload)
  }

  const onActionRefused = (payload: ActionRefusedPayload) => {
    const reason = String(payload?.reason || "Action was refused.")
    showActionFeedback({
      kind: "REFUSED",
      text: reason,
    })
    console.log("actionRefused", payload)
  }

  socket.on("yourRole", onYourRole)
  socket.on("privateMessage", onPrivateMessage)
  socket.on("nightSummary", onNightSummary)
  socket.on("voteSummary", onVoteSummary)
  socket.on("gameOver", onGameOver)
  socket.on("actionAccepted", onActionAccepted)
  socket.on("actionRefused", onActionRefused)

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
  }
}, [cleanRoomId])

useEffect(() => {
  setQuickMenuOpen(false)
  setShowRoleWhilePressed(false)
}, [state?.phase])

useEffect(() => {
  if (!quickMenuOpen) return

  const onPointerDown = (event: PointerEvent) => {
    if (!quickMenuRef.current) return
    if (quickMenuRef.current.contains(event.target as Node)) return
    setQuickMenuOpen(false)
    setShowRoleWhilePressed(false)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return
    setQuickMenuOpen(false)
    setShowRoleWhilePressed(false)
  }

  window.addEventListener("pointerdown", onPointerDown)
  window.addEventListener("keydown", onKeyDown)
  return () => {
    window.removeEventListener("pointerdown", onPointerDown)
    window.removeEventListener("keydown", onKeyDown)
  }
}, [quickMenuOpen])

    const isHost = state?.hostId === clientId
    const me = state?.players?.find((p) => p.clientId === clientId) ?? null
    const amSpectator = me?.isSpectator === true
    const isGameOverPhase = state?.phase === "GAMEOVER"
    const canUseTestingTools = Boolean(isHost && state?.roomType === "CLASSIC")
    const myStatus = me?.alive === false ? "Dead" : "Alive"
    const roleLabel = myRole ? getRoleLabel(myRole) : "Unknown"

    const phaseLabel = state ? getPhaseLabel(state.phase) : "Loading"
    const timerLabel = remainingSec === null ? "--" : `${remainingSec}s`

    const leaveRoom = () => {
      setQuickMenuOpen(false)
      setShowRoleWhilePressed(false)
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

    const submitRoleAction = (kind: RoleActionKind, targetClientId: string) => {
      socket.emit("submitRoleAction", { roomId: cleanRoomId, kind, targetClientId })
    }

    const startRolePeek = () => {
      setShowRoleWhilePressed(true)
    }

    const stopRolePeek = () => {
      setShowRoleWhilePressed(false)
    }

    const toggleQuickMenu = () => {
      setQuickMenuOpen((prev) => !prev)
      if (quickMenuOpen) {
        setShowRoleWhilePressed(false)
      }
    }

    const skipPhaseForTesting = () => {
      if (!isHost) return
      if (!state) return
      if (state.phase === "GAMEOVER") return

      setQuickMenuOpen(false)
      setShowRoleWhilePressed(false)
      socket.emit("skipPhase", { roomId: cleanRoomId })
    }

    return (
      <div className={`game-page game-page--${state?.phase?.toLowerCase() ?? "loading"}`}>
        <div className={`game-phase-canvas ${isGameOverPhase ? "is-gameover" : ""}`}>
          <div className="game-phase-topbar">
            <div className="game-phase-topbar__timer">Time: {timerLabel}</div>
            <div className="game-phase-topbar__phase">{phaseLabel}</div>

            <div className="game-phase-topbar__right">
              <span className={`game-status-pill ${myStatus === "Alive" ? "is-alive" : "is-dead"}`}>
                {myStatus}
              </span>

              {!isGameOverPhase && (
                <div className="game-quick-menu" ref={quickMenuRef}>
                  <button
                    type="button"
                    className="game-quick-menu__trigger"
                    onClick={toggleQuickMenu}
                    aria-expanded={quickMenuOpen}
                    aria-haspopup="menu"
                    title="Open player menu"
                  >
                    <span className="game-quick-menu__bar" />
                    <span className="game-quick-menu__bar" />
                    <span className="game-quick-menu__bar" />
                  </button>

                  {quickMenuOpen && (
                    <div className="game-quick-menu__panel" role="menu">
                      <button
                        type="button"
                        className="game-quick-menu__hold"
                        onPointerDown={startRolePeek}
                        onPointerUp={stopRolePeek}
                        onPointerCancel={stopRolePeek}
                        onPointerLeave={stopRolePeek}
                        onBlur={stopRolePeek}
                        title={`Player: ${cleanPlayerName}`}
                      >
                        Hold to Reveal Role
                      </button>

                      <div className={`game-quick-menu__role ${showRoleWhilePressed ? "is-revealed" : ""}`}>
                        {showRoleWhilePressed ? roleLabel : "Hidden"}
                      </div>

                      <button
                        type="button"
                        className="game-quick-menu__leave"
                        onClick={leaveRoom}
                      >
                        Leave Room
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <main className={`game-phase-host ${isGameOverPhase ? "is-gameover" : ""}`}>
            {state ? (
              <PhaseRouter
                phase={state.phase}
                state={state}
                me={me}
                isHost={isHost}
                isSpectator={amSpectator}
                myRole={myRole}
                rolemateClientIds={rolemateClientIds}
                privateMessages={privateMessages}
                banner={banner}
                winner={winner}
                actionFeedback={actionFeedback}
                submitRoleAction={submitRoleAction}
              />
            ) : (
              <div className="game-phase-loading">Waiting for room state...</div>
            )}
          </main>

          {isGameOverPhase && (
            <div className="game-phase-bottom-actions">
              <button className="game-button game-button--leave" onClick={leaveRoom}>
                Leave Room
              </button>
              <button className="game-button game-button--back" onClick={backToLobby}>
                Back to Lobby
              </button>
              <button
                className={`game-button game-button--start ${!isHost ? "is-disabled" : ""}`}
                onClick={startNewGame}
                disabled={!isHost}
                title={isHost ? "Start a fresh game immediately." : "Only the host can start a new game."}
              >
                Start New Game
              </button>
            </div>
          )}

          {canUseTestingTools && !isGameOverPhase && (
            <button
              type="button"
              className="game-skip-phase-floating"
              onClick={skipPhaseForTesting}
              title="Skip to next phase (testing)"
            >
              Skip Phase
            </button>
          )}
        </div>
      </div>
    )
}




