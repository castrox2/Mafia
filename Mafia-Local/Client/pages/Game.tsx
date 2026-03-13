import React, { useEffect, useMemo, useState, useRef } from "react"
import { socket, clientId } from "../src/socket.js"
import { PhaseRouter } from "../components/PhaseRouter.js"
import RoleRollOverlay from "../components/RoleRollOverlay.js"
import type { RoomState } from "../src/types.js"
import { normalizeRoomId, SKIP_TARGET_CLIENT_ID } from "../../Shared/events.js"
import "../src/styles/pages/game.css"
import type {
  ActionAcceptedPayload,
  ActionRefusedPayload,
  GameOverPayload,
  MafiaWinner,
  PhaseEndingPayload,
  PhaseStartedPayload,
  PublicAnnouncementsPayload,
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
import {
  getRegularRoleImageSrc,
  getRegularRoleRollCandidates,
} from "../src/roleRoll.js"

type Props = {
    roomId: string
    playerName: string
    onExit: () => void
    onBackToLobby: () => void
}

type Winner = MafiaWinner
type ActionFeedback = null | { kind: "ACCEPTED" | "REFUSED"; text: string }
type DetectiveResultPopup = null | { checkedClientId: string; isMafia: boolean }

const formatRemainingTime = (seconds: number | null): string => {
  if (seconds == null) return "--m --s"
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  return `${String(minutes).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`
}

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
    const [banner, setBanner] = useState<null | { kind: "NIGHT" | "VOTING" | "PUBLIC"; text: string }>(null)

    // Private messages (ex: Detective result). UI teammate can turn into toast/modal later.
    const [privateMessages, setPrivateMessages] = useState<PrivateMessagePayload[]>([])
    const [detectiveResultPopup, setDetectiveResultPopup] = useState<DetectiveResultPopup>(null)

    // End-game winner (authoritative event from server)
    const [winner, setWinner] = useState<Winner | null>(null)

    // Short-lived action feedback ("accepted"/"refused")
    const [actionFeedback, setActionFeedback] = useState<ActionFeedback>(null)
    const [showRoleWhilePressed, setShowRoleWhilePressed] = useState(false)
    const [quickMenuOpen, setQuickMenuOpen] = useState(false)
    const [sheriffPanelOpen, setSheriffPanelOpen] = useState(false)
    const [sheriffAbilityUsed, setSheriffAbilityUsed] = useState(false)
    const [roleRollOpen, setRoleRollOpen] = useState(false)

    const bannerTimeoutRef = useRef<number | null>(null)
    const actionFeedbackTimeoutRef = useRef<number | null>(null)
    const quickMenuRef = useRef<HTMLDivElement | null>(null)
    const sheriffPanelRef = useRef<HTMLDivElement | null>(null)

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
    if (payload.type === "DETECTIVE_RESULT") {
      setDetectiveResultPopup({
        checkedClientId: payload.checkedClientId,
        isMafia: payload.isMafia === true,
      })
    }
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

  const onPublicAnnouncements = (payload: PublicAnnouncementsPayload) => {
    if (payload.roomId !== cleanRoomId) return
    if (!Array.isArray(payload.announcements) || payload.announcements.length <= 0) return

    const sheriffAnnouncement = payload.announcements.find(
      (announcement) => announcement.type === "SHERIFF_USED"
    )

    if (sheriffAnnouncement && sheriffAnnouncement.type === "SHERIFF_USED") {
      if (sheriffAnnouncement.byClientId === clientId) {
        setSheriffAbilityUsed(true)
      }

      setBanner({
        kind: "PUBLIC",
        text: sheriffAnnouncement.mafiaKilled
          ? "Sheriff shot landed: mafia target eliminated."
          : "Sheriff shot landed: target was not mafia.",
      })

      if (bannerTimeoutRef.current) {
        window.clearTimeout(bannerTimeoutRef.current)
      }
      bannerTimeoutRef.current = window.setTimeout(() => {
        setBanner(null)
      }, 1800)
    }
  }

  const onGameOver = (payload: GameOverPayload) => {
    if (payload.roomId !== cleanRoomId) return

    setWinner(payload.winner)
    console.log("gameOver", payload)
  }

  const onActionAccepted = (payload: ActionAcceptedPayload) => {
    const actionKind = getActionRecordedLabel(String(payload?.kind || "ACTION"))
    const acceptedKind = String(payload?.kind || "").trim()
    if (acceptedKind === "SHERIFF_SHOOT") {
      setSheriffAbilityUsed(true)
      setSheriffPanelOpen(false)
      setQuickMenuOpen(false)
      setShowRoleWhilePressed(false)
    }

    showActionFeedback({
      kind: "ACCEPTED",
      text: `${actionKind} recorded.`,
    })
    console.log("actionAccepted", payload)
  }

  const onActionRefused = (payload: ActionRefusedPayload) => {
    const reason = String(payload?.reason || "Action was refused.")
    const refusedKind = String(payload?.kind || "").trim()
    if (
      refusedKind === "SHERIFF_SHOOT" &&
      reason.toLowerCase().includes("once per game")
    ) {
      setSheriffAbilityUsed(true)
      setSheriffPanelOpen(false)
    }

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
  socket.on("publicAnnouncements", onPublicAnnouncements)
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
    socket.off("publicAnnouncements", onPublicAnnouncements)
    socket.off("gameOver", onGameOver)
    socket.off("actionAccepted", onActionAccepted)
    socket.off("actionRefused", onActionRefused)
  }
}, [cleanRoomId])

useEffect(() => {
  setQuickMenuOpen(false)
  setShowRoleWhilePressed(false)
  setSheriffPanelOpen(false)
}, [state?.phase])

useEffect(() => {
  setSheriffAbilityUsed(false)
}, [cleanRoomId, state?.gameNumber])

useEffect(() => {
  if (!state?.gameStarted) {
    setRoleRollOpen(false)
    return
  }
  if (state.roomType !== "CLASSIC") return
  if (state.phase !== "DAY") return
  if (!myRole) return
  const amSpectatorNow =
    state.players.find((player) => player.clientId === clientId)?.isSpectator === true
  if (amSpectatorNow) return

  const seenKey = `mafia_role_roll_seen:${cleanRoomId}:game${state.gameNumber}:client:${clientId}`
  if (window.sessionStorage.getItem(seenKey) === "1") return

  window.sessionStorage.setItem(seenKey, "1")
  setRoleRollOpen(true)
}, [
  cleanRoomId,
  myRole,
  state?.players,
  state?.gameNumber,
  state?.gameStarted,
  state?.phase,
  state?.roomType,
])

useEffect(() => {
  if (!detectiveResultPopup) return

  const timeoutId = window.setTimeout(() => {
    setDetectiveResultPopup(null)
  }, 3200)

  return () => window.clearTimeout(timeoutId)
}, [detectiveResultPopup])

useEffect(() => {
  if (!sheriffPanelOpen) return

  const htmlEl = document.documentElement
  const bodyEl = document.body
  const lockScrollY = window.scrollY
  const previousBodyStyle = {
    position: bodyEl.style.position,
    top: bodyEl.style.top,
    left: bodyEl.style.left,
    right: bodyEl.style.right,
    width: bodyEl.style.width,
    overflow: bodyEl.style.overflow,
  }

  htmlEl.classList.add("ui-no-scroll")
  bodyEl.classList.add("ui-no-scroll")
  bodyEl.style.position = "fixed"
  bodyEl.style.top = `-${lockScrollY}px`
  bodyEl.style.left = "0"
  bodyEl.style.right = "0"
  bodyEl.style.width = "100%"
  bodyEl.style.overflow = "hidden"

  return () => {
    htmlEl.classList.remove("ui-no-scroll")
    bodyEl.classList.remove("ui-no-scroll")

    bodyEl.style.position = previousBodyStyle.position
    bodyEl.style.top = previousBodyStyle.top
    bodyEl.style.left = previousBodyStyle.left
    bodyEl.style.right = previousBodyStyle.right
    bodyEl.style.width = previousBodyStyle.width
    bodyEl.style.overflow = previousBodyStyle.overflow

    window.scrollTo(0, lockScrollY)
  }
}, [sheriffPanelOpen])

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
    const regularRoleRollCandidates = useMemo(() => getRegularRoleRollCandidates(), [])
    const roleRollImageSrc = useMemo(
      () => getRegularRoleImageSrc(myRole),
      [myRole]
    )
    const sheriffActionAllowedPhase =
      state?.phase === "DAY" ||
      state?.phase === "DISCUSSION" ||
      state?.phase === "PUBDISCUSSION"
    const canUseSheriffMenuAction = Boolean(
      myRole === "SHERIFF" &&
      me?.alive === true &&
      !amSpectator &&
      sheriffActionAllowedPhase &&
      !sheriffAbilityUsed
    )
    const canRenderSheriffMenuAction = Boolean(
      myRole === "SHERIFF" &&
      me?.alive === true &&
      !amSpectator &&
      sheriffActionAllowedPhase
    )
    const sheriffTargets =
      canUseSheriffMenuAction && state
        ? state.players.filter(
            (player) =>
              player.clientId !== me?.clientId &&
              player.alive === true &&
              player.isSpectator !== true
          )
        : []
    const detectiveTargetName =
      detectiveResultPopup && state
        ? state.players.find((player) => player.clientId === detectiveResultPopup.checkedClientId)?.name ??
          detectiveResultPopup.checkedClientId
        : ""

    const phaseLabel = state ? getPhaseLabel(state.phase) : "Loading"
    const timerLabel = formatRemainingTime(remainingSec)

    const leaveRoom = () => {
      setQuickMenuOpen(false)
      setShowRoleWhilePressed(false)
      setSheriffPanelOpen(false)
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

    const openSheriffPanelFromMenu = () => {
      if (!canUseSheriffMenuAction) return
      setQuickMenuOpen(false)
      setShowRoleWhilePressed(false)
      setSheriffPanelOpen(true)
    }

    const closeSheriffPanel = () => {
      setSheriffPanelOpen(false)
    }

    const submitSheriffShoot = (targetClientId: string) => {
      if (!canUseSheriffMenuAction) return
      socket.emit("submitRoleAction", {
        roomId: cleanRoomId,
        kind: "SHERIFF_SHOOT",
        targetClientId,
      })
      setSheriffPanelOpen(false)
    }

    const skipPhaseForTesting = () => {
      if (!isHost) return
      if (!state) return
      if (state.phase === "GAMEOVER") return

      setQuickMenuOpen(false)
      setShowRoleWhilePressed(false)
      socket.emit("skipPhase", { roomId: cleanRoomId })
    }

    const closeRoleRollOverlay = () => {
      setRoleRollOpen(false)
    }

    return (
      <div className={`game-page game-page--${state?.phase?.toLowerCase() ?? "loading"}`}>
        <div className={`game-phase-canvas ${isGameOverPhase ? "is-gameover" : ""}`}>
          <RoleRollOverlay
            open={roleRollOpen}
            title="Assigning Role"
            finalLabel={roleLabel}
            finalImageSrc={roleRollImageSrc}
            candidates={regularRoleRollCandidates}
            onComplete={closeRoleRollOverlay}
            onSkip={closeRoleRollOverlay}
          />

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

                      {canRenderSheriffMenuAction && (
                        <button
                          type="button"
                          className="game-quick-menu__sheriff"
                          onClick={openSheriffPanelFromMenu}
                          disabled={!canUseSheriffMenuAction}
                        >
                          {canUseSheriffMenuAction ? "Sheriff Action" : "Sheriff Action Used"}
                        </button>
                      )}

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
              className={`game-skip-phase-floating ${state?.phase === "VOTING" ? "is-left" : ""}`}
              onClick={skipPhaseForTesting}
              title="Skip to next phase (testing)"
            >
              Skip Phase
            </button>
          )}

          {sheriffPanelOpen && canUseSheriffMenuAction && (
            <div
              className="game-sheriff-panel-overlay"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  closeSheriffPanel()
                }
              }}
              onWheel={(event) => {
                if (!sheriffPanelRef.current) {
                  event.preventDefault()
                  return
                }
                if (!sheriffPanelRef.current.contains(event.target as Node)) {
                  event.preventDefault()
                }
              }}
              onTouchMove={(event) => {
                if (!sheriffPanelRef.current) {
                  event.preventDefault()
                  return
                }
                if (!sheriffPanelRef.current.contains(event.target as Node)) {
                  event.preventDefault()
                }
              }}
            >
              <div
                ref={sheriffPanelRef}
                className="game-sheriff-panel"
                role="dialog"
                aria-modal="true"
              >
                <div className="game-sheriff-panel__title">Sheriff Action</div>
                <div className="game-sheriff-panel__help">Choose a target to shoot.</div>

                {sheriffTargets.length <= 0 ? (
                  <div className="game-sheriff-panel__empty">No valid targets available.</div>
                ) : (
                  <div className="game-sheriff-panel__list">
                    {sheriffTargets.map((target) => (
                      <button
                        key={target.clientId}
                        type="button"
                        className="game-sheriff-panel__target"
                        onClick={() => submitSheriffShoot(target.clientId)}
                      >
                        <span className="game-sheriff-panel__target-name">{target.name}</span>
                        <span className="game-sheriff-panel__target-action">Shoot</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="game-sheriff-panel__actions">
                  <button
                    type="button"
                    className="game-sheriff-panel__skip"
                    onClick={() => submitSheriffShoot(SKIP_TARGET_CLIENT_ID)}
                  >
                    Skip Shot
                  </button>
                  <button
                    type="button"
                    className="game-sheriff-panel__close"
                    onClick={closeSheriffPanel}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {detectiveResultPopup && (
            <div
              className="game-detective-popup"
              role="dialog"
              aria-live="polite"
              aria-label="Detective investigation result"
            >
              <div className="game-detective-popup__title">Investigation Result</div>
              <div className="game-detective-popup__text">
                {detectiveTargetName} {detectiveResultPopup.isMafia ? "is Mafia." : "is not Mafia."}
              </div>
              <button
                type="button"
                className="game-detective-popup__close"
                onClick={() => setDetectiveResultPopup(null)}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    )
}





