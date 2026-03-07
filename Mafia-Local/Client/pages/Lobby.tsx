import React, { useEffect, useMemo, useState } from "react"
import { socket, clientId } from "../src/socket.js"
import type { RoomState } from "../src/types.js"
import HostSettingsModal from "../components/HostSettings.js"
import RoleSelectorSettingsModal from "../components/RoleSelectorSettings.js"
import RoleCatalogModal from "../components/RoleCatalogModal.js"
import RoleInfoModal from "../components/RoleInfoModal.js"
import { normalizeRoomId } from "../../Shared/events.js"
import type {
  AddBotRefusedPayload,
  BotcScriptSummaryPayload,
  GameStartedPayload,
  MafiaPlayerRole,
  HostParticipationRefusedEvent,
  HostParticipationRefusedPayload,
  RoleSelectorHostCountsPayload,
  RoomStatePayload,
  ReasonPayload,
  RoomIdPayload,
  SetHostParticipationEvent,
  SetHostParticipationPayload,
  YourRolePayload,
} from "../../Shared/events.js"
import { getPlayerTags, getRoleLabel, getStatusLabel } from "../src/uiMeta.js"
import { getBotcRoleInfo } from "../src/constants/botcRoleInfo.js"
import "../src/styles/pages/lobby.css"

type Props = {
  roomId: string
  playerName: string
  joinUrl: string
  qrDataUrl: string
  onExit: () => void

  // App controls which screen is shown.
  // Lobby notifies App when the game starts.
  onEnterGame: () => void
}

const shortPlayerId = (id: string): string => {
  const clean = String(id || "").trim()
  if (!clean) return "unknown"
  if (clean === clientId) return "you"
  return clean.slice(0, 8)
}

const initialForName = (name: string): string => {
  const clean = String(name || "").trim()
  return clean ? clean.charAt(0).toUpperCase() : "?"
}

const statusClassName = (status: string): string => {
  if (status === "READY") return "is-ready"
  if (status === "NOT READY") return "is-not-ready"
  if (status === "DISCONNECTED") return "is-disconnected"
  return "is-neutral"
}

const TEST_ROLE_OPTIONS: MafiaPlayerRole[] = [
  "CIVILIAN",
  "MAFIA",
  "DOCTOR",
  "DETECTIVE",
  "SHERIFF",
]

export default function Lobby({
  roomId,
  playerName,
  joinUrl,
  qrDataUrl,
  onExit,
  onEnterGame,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [roleCatalogOpen, setRoleCatalogOpen] = useState(false)
  const [myRoleInfoOpen, setMyRoleInfoOpen] = useState(false)
  const [state, setState] = useState<RoomState | null>(null)
  const [status, setStatus] = useState("")
  const [myRole, setMyRole] = useState<YourRolePayload["role"] | null>(null)
  const [hostRoleCounts, setHostRoleCounts] =
    useState<RoleSelectorHostCountsPayload | null>(null)
  const [manualRolesOpen, setManualRolesOpen] = useState(false)
  const [manualRoleDraft, setManualRoleDraft] = useState<Record<string, MafiaPlayerRole>>({})

  const cleanRoomId = useMemo(() => normalizeRoomId(roomId), [roomId])
  const cleanPlayerName = useMemo(() => playerName.trim(), [playerName])

  const roomType: RoomStatePayload["roomType"] = state?.roomType ?? "CLASSIC"
  const isRoleSelectorRoom = roomType === "ROLE_SELECTOR"
  const isHost = state?.hostId === clientId
  const me = state?.players?.find((p) => p.clientId === clientId) ?? null
  const players = state?.players ?? []

  const amSpectator = me?.isSpectator === true
  const hostParticipates = state?.hostParticipates ?? true
  const allowRoleRedeal = state?.roleSelectorSettings?.allowRedeal ?? false
  const roleSelectorScriptMode = state?.roleSelectorSettings?.scriptMode ?? "REGULAR_MAFIA"
  const missingBotcScript =
    isRoleSelectorRoom &&
    roleSelectorScriptMode === "BLOOD_ON_THE_CLOCKTOWER" &&
    !state?.botcScriptSummary

  const myBotcRoleInfo =
    roleSelectorScriptMode === "BLOOD_ON_THE_CLOCKTOWER" && myRole
      ? getBotcRoleInfo(String(myRole))
      : null

  const myRoleLabel =
    myRole == null
      ? null
      : roleSelectorScriptMode === "BLOOD_ON_THE_CLOCKTOWER"
        ? myBotcRoleInfo?.roleName ?? String(myRole)
        : getRoleLabel(myRole)

  const amReady = me?.status === "READY"
  const activePlayers = players.filter((p) => !p.isSpectator)
  const allReady = activePlayers.length > 0 && activePlayers.every((p) => p.status === "READY")
  const canUseManualRoleAssign = Boolean(
    isHost && !isRoleSelectorRoom && state && !state.gameStarted
  )

  const lobbyTitle = isRoleSelectorRoom ? "Role Selector Lobby" : "Lobby"
  const joinLink = joinUrl || `${window.location.origin}/?room=${cleanRoomId}`

  useEffect(() => {
    if (roleSelectorScriptMode !== "BLOOD_ON_THE_CLOCKTOWER" || !myRole) {
      setMyRoleInfoOpen(false)
    }
  }, [myRole, roleSelectorScriptMode])

  useEffect(() => {
    if (!manualRolesOpen) return
    if (!state) return

    setManualRoleDraft((prev) => {
      const next: Record<string, MafiaPlayerRole> = {}
      for (const player of state.players) {
        if (player.isSpectator) continue
        next[player.clientId] = prev[player.clientId] ?? "CIVILIAN"
      }
      return next
    })
  }, [manualRolesOpen, state])

  useEffect(() => {
    const onRoomState = (s: RoomState) => {
      setState(s)
      setStatus(`In room: ${s.roomId}${clientId === s.hostId ? " (Host)" : ""}`)

      const currentPlayer = s.players.find((p) => p.clientId === clientId) ?? null

      if (s.roomType === "ROLE_SELECTOR") {
        if (currentPlayer?.isSpectator === true) {
          setMyRole(null)
        }
        if (s.gameStarted) {
          socket.emit("requestMyRole", { roomId: cleanRoomId })
          if (s.roomLocked) {
            setStatus(
              `Role selector started (Deal #${s.gameNumber}). Room is locked to new joins.`
            )
          }
        } else {
          setMyRole(null)
        }
        return
      }

      setMyRole(null)
      setHostRoleCounts(null)

      if (s.gameStarted) {
        onEnterGame()
      }
    }

    const onRoomClosed = ({ roomId: closedRoomId }: RoomIdPayload) => {
      if (closedRoomId === cleanRoomId) {
        alert("Room was closed by the host.")
        onExit()
      }
    }

    const onStartRefused = ({ reason }: ReasonPayload) => {
      alert(reason)
    }

    const onSettingsRefused = ({ reason }: ReasonPayload) => {
      alert(reason)
    }

    const onHostParticipationRefused: HostParticipationRefusedEvent = ({
      reason,
    }: HostParticipationRefusedPayload) => {
      alert(reason)
    }

    const onGameStarted = ({ gameNumber, roomType }: GameStartedPayload) => {
      if (roomType === "ROLE_SELECTOR") {
        setStatus(`Roles dealt! (Deal #${gameNumber})`)
        socket.emit("requestMyRole", { roomId: cleanRoomId })
        return
      }

      setStatus(`Game started! (Game #${gameNumber})`)
      onEnterGame()
    }

    const onKicked = ({ reason }: ReasonPayload & RoomIdPayload) => {
      alert(reason || "You were kicked.")
      onExit()
    }

    const onAddBotRefused = ({ reason }: AddBotRefusedPayload) => {
      alert(reason || "Unable to add bot.")
    }

    const onYourRole = (payload: YourRolePayload) => {
      if (payload.roomId !== cleanRoomId) return
      setMyRole(payload.role)
    }

    const onRoleSelectorHostCounts = (payload: RoleSelectorHostCountsPayload) => {
      if (payload.roomId !== cleanRoomId) return
      setHostRoleCounts(payload)
    }

    const onBotcScriptImported = (
      payload: RoomIdPayload & { summary: BotcScriptSummaryPayload }
    ) => {
      if (payload.roomId !== cleanRoomId) return
      setStatus(
        `BOCT script imported: ${payload.summary.name} (${payload.summary.roleCount} roles).`
      )
    }

    socket.on("roomState", onRoomState)
    socket.on("roomClosed", onRoomClosed)
    socket.on("startRefused", onStartRefused)
    socket.on("settingsRefused", onSettingsRefused)
    socket.on("hostParticipationRefused", onHostParticipationRefused)
    socket.on("gameStarted", onGameStarted)
    socket.on("yourRole", onYourRole)
    socket.on("roleSelectorHostCounts", onRoleSelectorHostCounts)
    socket.on("botcScriptImported", onBotcScriptImported)
    socket.on("kicked", onKicked)
    socket.on("addBotRefused", onAddBotRefused)

    const skipAutoJoin =
      window.sessionStorage.getItem("mafia_skip_lobby_autojoin") === "1"
    if (skipAutoJoin) {
      window.sessionStorage.removeItem("mafia_skip_lobby_autojoin")
    } else if (cleanRoomId && cleanPlayerName) {
      socket.emit("joinRoom", {
        roomId: cleanRoomId,
        playerName: cleanPlayerName,
      })
    }

    if (cleanRoomId) {
      socket.emit("requestMyRole", { roomId: cleanRoomId })
    }

    return () => {
      socket.off("roomState", onRoomState)
      socket.off("roomClosed", onRoomClosed)
      socket.off("startRefused", onStartRefused)
      socket.off("settingsRefused", onSettingsRefused)
      socket.off("hostParticipationRefused", onHostParticipationRefused)
      socket.off("gameStarted", onGameStarted)
      socket.off("yourRole", onYourRole)
      socket.off("roleSelectorHostCounts", onRoleSelectorHostCounts)
      socket.off("botcScriptImported", onBotcScriptImported)
      socket.off("kicked", onKicked)
      socket.off("addBotRefused", onAddBotRefused)
    }
  }, [cleanRoomId, cleanPlayerName, onExit, onEnterGame])

  const leaveRoom = () => {
    socket.emit("leaveRoom", cleanRoomId)
    setState(null)
    onExit()
  }

  const toggleReady = () => {
    socket.emit("setPlayerStatus", {
      roomId: cleanRoomId,
      playerId: clientId,
      status: amReady ? "NOT READY" : "READY",
    })
  }

  const toggleHostParticipation = (nextParticipates: boolean) => {
    if (hostParticipates && !nextParticipates) {
      const confirmed = window.confirm(
        "Turn host participation off? You will become a spectator and will not receive a role until you opt back in."
      )
      if (!confirmed) return
    }

    const payload: SetHostParticipationPayload = {
      roomId: cleanRoomId,
      participates: nextParticipates,
    }

    const emitSetHostParticipation: SetHostParticipationEvent = (nextPayload) => {
      socket.emit("setHostParticipation", nextPayload)
    }

    emitSetHostParticipation(payload)
  }

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(cleanRoomId)
      setStatus(`Room code copied: ${cleanRoomId}`)
    } catch (_err) {
      setStatus("Could not copy room code in this environment.")
    }
  }

  const shareRoom = async () => {
    const shareText = `Join my Mafia room (${cleanRoomId})`

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Mafia",
          text: shareText,
          url: joinLink,
        })
        return
      } catch (_err) {
        // User canceled or share failed; fall through to clipboard copy.
      }
    }

    try {
      await navigator.clipboard.writeText(joinLink)
      setStatus("Invite link copied.")
    } catch (_err) {
      setStatus("Could not share or copy invite link.")
    }
  }

  const startClassicGame = () => {
    socket.emit("startGame", { roomId: cleanRoomId })
  }

  const forceStartClassicGame = () => {
    socket.emit("forceStartGame", { roomId: cleanRoomId })
  }

  const startRoleSelector = () => {
    socket.emit("startGame", { roomId: cleanRoomId })
  }

  const addBotPlayer = () => {
    socket.emit("addBot", { roomId: cleanRoomId })
  }

  const openManualRoleAssign = () => {
    if (!canUseManualRoleAssign) return
    setManualRolesOpen(true)
  }

  const closeManualRoleAssign = () => {
    setManualRolesOpen(false)
  }

  const setDraftRole = (targetClientId: string, role: MafiaPlayerRole) => {
    setManualRoleDraft((prev) => ({
      ...prev,
      [targetClientId]: role,
    }))
  }

  const applyManualRoleAssign = () => {
    if (!canUseManualRoleAssign) return
    if (!state) return

    for (const player of state.players) {
      if (player.isSpectator) continue
      const role = manualRoleDraft[player.clientId] ?? "CIVILIAN"
      socket.emit("setRole", {
        roomId: cleanRoomId,
        playerId: player.clientId,
        role,
      })
    }

    setManualRolesOpen(false)
  }

  const redealRoleSelector = () => {
    socket.emit("redealRoleSelector", { roomId: cleanRoomId })
  }

  return (
    <div className="lobby-page">
      <aside className="lobby-sidebar">
        <div className="lobby-sidebar-brand">
          <img
            src="/assets/Mafia-Icon.png"
            alt="Mafia logo"
            className="lobby-sidebar-logo"
            onError={(event) => {
              event.currentTarget.style.display = "none"
            }}
          />
          <span className="lobby-sidebar-brand-name">MafiaGame</span>
        </div>

        <div className="lobby-self-card">
          <div className="lobby-self-avatar">{initialForName(cleanPlayerName)}</div>
          <div className="lobby-self-meta">
            <div className="lobby-self-name">You</div>
            <div className="lobby-self-id">ID: {shortPlayerId(clientId)}</div>
            {!isRoleSelectorRoom && me && (
              <span className={`lobby-status-pill ${statusClassName(me.status)}`}>
                {getStatusLabel(me.status)}
              </span>
            )}
            {isRoleSelectorRoom && amSpectator && (
              <span className="lobby-small-chip">Dealer Only</span>
            )}
          </div>
        </div>

        <div className="lobby-sidebar-actions">
          {isHost && (
            <button
              type="button"
              className="lobby-side-button"
              onClick={() => setSettingsOpen(true)}
            >
              {isRoleSelectorRoom ? "Role Selector Settings" : "Settings"}
            </button>
          )}

          {canUseManualRoleAssign && (
            <button
              type="button"
              className="lobby-side-button"
              onClick={openManualRoleAssign}
            >
              Manual Role Assign
            </button>
          )}

          {isRoleSelectorRoom && (
            <button
              type="button"
              className="lobby-side-button"
              onClick={() => setRoleCatalogOpen(true)}
            >
              Available Roles
            </button>
          )}

          {!amSpectator && !isRoleSelectorRoom && (
            <button
              type="button"
              className={`lobby-side-button ${amReady ? "is-warning" : "is-good"}`}
              onClick={toggleReady}
            >
              {amReady ? "Unready" : "Ready"}
            </button>
          )}

          <button
            type="button"
            className="lobby-side-button lobby-side-button-leave"
            onClick={leaveRoom}
          >
            Leave
          </button>
        </div>
      </aside>

      <main className="lobby-main">
        <header className="lobby-header">
          <div className="lobby-heading-wrap">
            <h1 className="lobby-heading">{lobbyTitle}</h1>
            <div className="lobby-code-row">
              <span className="lobby-code-label">Code: {cleanRoomId}</span>
              <button type="button" className="lobby-inline-action" onClick={copyRoomCode}>
                Copy
              </button>
              <button type="button" className="lobby-inline-action" onClick={shareRoom}>
                Share
              </button>
            </div>
          </div>

          <div className="lobby-header-actions">
            <div className="lobby-player-pill">Players: {players.length}</div>

            {isHost && !isRoleSelectorRoom && !state?.gameStarted && (
              <button
                type="button"
                className="lobby-add-bot"
                onClick={addBotPlayer}
                title="Add a test bot player"
              >
                Add Bot
              </button>
            )}

            {isHost && !isRoleSelectorRoom && (
              <>
                <button
                  type="button"
                  className={`lobby-start-button ${allReady ? "is-ready" : "is-disabled"}`}
                  disabled={!allReady}
                  onClick={startClassicGame}
                >
                  Start Game
                </button>
                {!allReady && (
                  <button
                    type="button"
                    className="lobby-force-start"
                    onClick={forceStartClassicGame}
                  >
                    Force
                  </button>
                )}
              </>
            )}

            {isHost && isRoleSelectorRoom && !state?.gameStarted && (
              <button
                type="button"
                className={`lobby-start-button ${missingBotcScript ? "is-disabled" : "is-ready"}`}
                disabled={missingBotcScript}
                onClick={startRoleSelector}
                title={missingBotcScript ? "Import a BOCT script first." : undefined}
              >
                {roleSelectorScriptMode === "BLOOD_ON_THE_CLOCKTOWER"
                  ? "Deal BOCT Roles"
                  : "Deal Roles"}
              </button>
            )}

            {isHost && isRoleSelectorRoom && state?.gameStarted && allowRoleRedeal && (
              <button
                type="button"
                className="lobby-start-button is-ready"
                onClick={redealRoleSelector}
              >
                Redeal Roles
              </button>
            )}
          </div>
        </header>

        {isHost && (
          <section className="lobby-info-panel">
            <label className="lobby-host-toggle">
              <input
                type="checkbox"
                checked={hostParticipates}
                disabled={state?.gameStarted === true}
                onChange={(event) => toggleHostParticipation(event.target.checked)}
              />
              <span>Host participates as a player</span>
            </label>
            {state?.gameStarted && (
              <div className="lobby-info-muted">
                Host participation can only be changed before the game starts.
              </div>
            )}
          </section>
        )}

        {state?.settings && !isRoleSelectorRoom && (
          <section className="lobby-info-panel">
            <div>
              roles: mafia {state.settings.roleCount.mafia}, doctor {state.settings.roleCount.doctor},
              detective {state.settings.roleCount.detective}, sheriff {state.settings.roleCount.sheriff}
            </div>
          </section>
        )}

        {state && isRoleSelectorRoom && (
          <section className="lobby-info-panel">
            <div>
              <strong>Mode:</strong>{" "}
              {roleSelectorScriptMode === "REGULAR_MAFIA"
                ? "Regular Mafia"
                : "Blood on the Clocktower"}
            </div>
            {roleSelectorScriptMode === "BLOOD_ON_THE_CLOCKTOWER" && (
              <div>
                <strong>Script:</strong>{" "}
                {state.botcScriptSummary
                  ? `${state.botcScriptSummary.name} (${state.botcScriptSummary.roleCount} roles)`
                  : "Not imported yet"}
              </div>
            )}
            <div>
              <strong>Room lock:</strong> {state.roomLocked ? "Locked" : "Open"}
            </div>
            <div>
              <strong>Redeal:</strong> {allowRoleRedeal ? "Enabled" : "Disabled"}
            </div>
          </section>
        )}

        {qrDataUrl && state?.hostId === clientId && (
          <section className="lobby-info-panel">
            <div className="lobby-info-title">Scan to join this room</div>
            <img src={qrDataUrl} alt="Room QR Code" className="lobby-qr-image" />
            <div>
              Link:{" "}
              <a href={joinLink} target="_blank" rel="noreferrer" className="lobby-join-link">
                {joinLink}
              </a>
            </div>
          </section>
        )}

        {amSpectator && (
          <section className="lobby-info-panel">
            {isRoleSelectorRoom
              ? "You are dealer-only for this room and will not receive a role."
              : "You are currently spectating and cannot ready up or receive a role."}
          </section>
        )}

        {state && isRoleSelectorRoom && (
          <section className="lobby-info-panel">
            {!state.gameStarted && (
              <div>
                {roleSelectorScriptMode === "REGULAR_MAFIA"
                  ? "Waiting for host to deal roles."
                  : state.botcScriptSummary
                  ? "BOCT script imported. Waiting for host to deal roles."
                  : "Waiting for host to import a BOCT script."}
              </div>
            )}

            {state.gameStarted && isHost && (
              <div>
                <div className="lobby-info-title">Host view: role counts only</div>
                {roleSelectorScriptMode === "BLOOD_ON_THE_CLOCKTOWER" ? (
                  <div>
                    Townsfolk: {hostRoleCounts?.botcCounts?.townsfolk ?? 0} | Outsiders:{" "}
                    {hostRoleCounts?.botcCounts?.outsiders ?? 0} | Minions:{" "}
                    {hostRoleCounts?.botcCounts?.minions ?? 0} | Demons:{" "}
                    {hostRoleCounts?.botcCounts?.demons ?? 0} | Other:{" "}
                    {hostRoleCounts?.botcCounts?.others ?? 0}
                  </div>
                ) : (
                  <div>
                    Mafia: {hostRoleCounts?.counts.mafia ?? 0} | Doctor:{" "}
                    {hostRoleCounts?.counts.doctor ?? 0} | Detective:{" "}
                    {hostRoleCounts?.counts.detective ?? 0} | Sheriff:{" "}
                    {hostRoleCounts?.counts.sheriff ?? 0} | Civilian:{" "}
                    {hostRoleCounts?.counts.civilian ?? 0}
                  </div>
                )}
              </div>
            )}

            {state.gameStarted && !isHost && !amSpectator && (
              <div>
                <strong>Your role:</strong> {myRoleLabel ?? "Waiting for assignment..."}
                {roleSelectorScriptMode === "BLOOD_ON_THE_CLOCKTOWER" && myRole && (
                  <button
                    type="button"
                    onClick={() => setMyRoleInfoOpen(true)}
                    title="Show role details"
                    className="lobby-role-help"
                  >
                    ?
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {status && <div className="lobby-status-line">{status}</div>}

        <section className="lobby-player-grid">
          {players.map((p) => {
            const tags = getPlayerTags(p, {
              hostId: state?.hostId ?? "",
              viewerClientId: clientId,
            }).filter((tag) => tag.key !== "YOU")

            const canKick =
              isHost &&
              p.clientId !== state?.hostId &&
              p.clientId !== clientId

            const displayName = p.clientId === clientId ? "You" : p.name

            return (
              <article
                key={p.clientId}
                className={`lobby-player-card ${p.clientId === state?.hostId ? "is-host" : ""}`}
              >
                <div className="lobby-player-avatar">{initialForName(displayName)}</div>

                <div className="lobby-player-body">
                  <div className="lobby-player-topline">
                    <div className="lobby-player-name-wrap">
                      <span className="lobby-player-name">{displayName}</span>
                      {p.clientId === state?.hostId && (
                        <span className="lobby-small-chip">HOST</span>
                      )}
                    </div>

                    {!isRoleSelectorRoom && (
                      <span className={`lobby-status-pill ${statusClassName(p.status)}`}>
                        {getStatusLabel(p.status)}
                      </span>
                    )}
                  </div>

                  <div className="lobby-player-subline">ID: {shortPlayerId(p.clientId)}</div>

                  {tags.length > 0 && (
                    <div className="lobby-tag-row">
                      {tags.map((tag) => (
                        <span key={`${p.clientId}_${tag.key}`} className="lobby-tag-chip">
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {canKick && (
                  <button
                    type="button"
                    className="lobby-kick-button"
                    onClick={() =>
                      socket.emit("kickPlayer", {
                        roomId: cleanRoomId,
                        targetClientId: p.clientId,
                      })
                    }
                    title="Remove player"
                  >
                    x
                  </button>
                )}
              </article>
            )
          })}
        </section>
      </main>

      {state && clientId === state.hostId && (
        <>
          {isRoleSelectorRoom ? (
            <RoleSelectorSettingsModal
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              roomState={state}
              botcScriptSummary={state.botcScriptSummary}
              onImportBotcScript={({ source, rawJson }) => {
                socket.emit("importBotcScript", {
                  roomId: cleanRoomId,
                  source,
                  rawJson,
                })
              }}
              onSave={({ roleCount, roleSelectorSettings }) => {
                socket.emit("updateSettings", {
                  roomId: cleanRoomId,
                  settings: { roleCount },
                })
                socket.emit("updateRoleSelectorSettings", {
                  roomId: cleanRoomId,
                  settings: roleSelectorSettings,
                })
                setSettingsOpen(false)
              }}
            />
          ) : (
            <HostSettingsModal
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              roomState={state}
              onSave={(settings) => {
                socket.emit("updateSettings", {
                  roomId: cleanRoomId,
                  settings,
                })
                setSettingsOpen(false)
              }}
            />
          )}
        </>
      )}

      {state && isRoleSelectorRoom && (
        <>
          <RoleCatalogModal
            open={roleCatalogOpen}
            onClose={() => setRoleCatalogOpen(false)}
            scriptMode={roleSelectorScriptMode}
            botcScriptSummary={state.botcScriptSummary}
          />

          <RoleInfoModal
            open={
              myRoleInfoOpen &&
              roleSelectorScriptMode === "BLOOD_ON_THE_CLOCKTOWER" &&
              Boolean(myRole)
            }
            onClose={() => setMyRoleInfoOpen(false)}
            roleName={myBotcRoleInfo?.roleName ?? String(myRole ?? "")}
            description={
              myBotcRoleInfo?.description ??
              (myRole ? `No description available yet for "${myRole}".` : "")
            }
          />
        </>
      )}

      {manualRolesOpen && canUseManualRoleAssign && state && (
        <div
          className="lobby-manual-roles-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeManualRoleAssign()
            }
          }}
        >
          <div className="lobby-manual-roles-panel" role="dialog" aria-modal="true">
            <h2 className="lobby-manual-roles-title">Manual Role Assignment (Testing)</h2>
            <p className="lobby-manual-roles-help">
              Temporary host-only tool for classic lobby testing.
            </p>

            <div className="lobby-manual-roles-list">
              {state.players
                .filter((player) => !player.isSpectator)
                .map((player) => (
                  <label key={player.clientId} className="lobby-manual-roles-row">
                    <span className="lobby-manual-roles-name">{player.name}</span>
                    <select
                      className="lobby-manual-roles-select"
                      value={manualRoleDraft[player.clientId] ?? "CIVILIAN"}
                      onChange={(event) =>
                        setDraftRole(
                          player.clientId,
                          event.target.value as MafiaPlayerRole
                        )
                      }
                    >
                      {TEST_ROLE_OPTIONS.map((roleOption) => (
                        <option key={roleOption} value={roleOption}>
                          {getRoleLabel(roleOption)}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
            </div>

            <div className="lobby-manual-roles-actions">
              <button
                type="button"
                className="lobby-inline-action"
                onClick={closeManualRoleAssign}
              >
                Cancel
              </button>
              <button
                type="button"
                className="lobby-start-button is-ready"
                onClick={applyManualRoleAssign}
              >
                Apply Roles
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
