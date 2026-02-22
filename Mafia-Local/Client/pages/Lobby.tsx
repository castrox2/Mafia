import React, { useEffect, useMemo, useState } from "react"
import { socket, clientId } from "../src/socket.js"
import type { RoomState } from "../src/types.js"
import HostSettingsModal from "../components/HostSettings.js"
import RoleSelectorSettingsModal from "../components/RoleSelectorSettings.js"
import RoleCatalogModal from "../components/RoleCatalogModal.js"
import RoleInfoModal from "../components/RoleInfoModal.js"
import { normalizeRoomId } from "../../Shared/events.js"
import type {
  BotcScriptSummaryPayload,
  GameStartedPayload,
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

type Props = {
  roomId: string
  playerName: string
  joinUrl: string
  qrDataUrl: string
  onExit: () => void

  // IMPORTANT:
  // App controls which screen is shown.
  // Lobby notifies App when the game starts.
  onEnterGame: () => void
}

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

  const cleanRoomId = useMemo(() => normalizeRoomId(roomId), [roomId])
  const cleanPlayerName = useMemo(() => playerName.trim(), [playerName])

  const roomType: RoomStatePayload["roomType"] = state?.roomType ?? "CLASSIC"
  const isRoleSelectorRoom = roomType === "ROLE_SELECTOR"
  const isHost = state?.hostId === clientId
  const me = state?.players?.find((p) => p.clientId === clientId) ?? null
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
  const activePlayers = (state?.players ?? []).filter((p) => !p.isSpectator)
  const allReady = activePlayers.length > 0 && activePlayers.every((p) => p.status === "READY")

  const actionButtonStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 16,
    borderRadius: 8,
    border: "1px solid #bdbdbd",
    background: "#fff",
    cursor: "pointer",
  }

  const readyToggleButtonStyle: React.CSSProperties = {
    ...actionButtonStyle,
    border: amReady ? "1px solid #d46a6a" : "1px solid #5ea66d",
    background: amReady ? "#fff2f2" : "#f2fff4",
  }

  useEffect(() => {
    if (roleSelectorScriptMode !== "BLOOD_ON_THE_CLOCKTOWER" || !myRole) {
      setMyRoleInfoOpen(false)
    }
  }, [myRole, roleSelectorScriptMode])

  useEffect(() => {
    const onRoomState = (s: RoomState) => {
      setState(s)
      setStatus(`In room: ${s.roomId}${clientId === s.hostId ? " (Host) " : ""}`)

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

      // Classic room flow: go to Game screen after game starts.
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

    /// If user navigates here directly, make sure we joined
    // IMPORTANT (reconnect-safe):
    // When resuming after refresh, the server may have already reattached this client.
    // In that case, skip this one-time auto-join to avoid duplicate player entries.
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

  const startRoleSelector = () => {
    socket.emit("startGame", { roomId: cleanRoomId })
  }

  const redealRoleSelector = () => {
    socket.emit("redealRoleSelector", { roomId: cleanRoomId })
  }

  return (
    <div style={{ padding: 20, maxWidth: 700, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <img
          src="/assets/Mafia-Icon.png"
          alt="Mafia logo"
          style={{ width: 56, height: 56, objectFit: "contain" }}
          onError={(event) => {
            event.currentTarget.style.display = "none"
          }}
        />
        <h1 style={{ marginBottom: 0, marginTop: 0 }}>
          {isRoleSelectorRoom ? "Role Selector Lobby" : "Lobby"}
        </h1>
      </div>

      {/* Host settings modal */}
      {clientId === state?.hostId && (
        <div>
          <button
            style={{ ...actionButtonStyle, marginBottom: 12 }}
            onClick={() => setSettingsOpen(true)}
          >
            {isRoleSelectorRoom ? "Role Selector Settings" : "Host Settings"}
          </button>
        </div>
      )}

      {isRoleSelectorRoom && (
        <div style={{ marginBottom: 12 }}>
          <button
            style={actionButtonStyle}
            onClick={() => setRoleCatalogOpen(true)}
          >
            Available Roles
          </button>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div>
          <strong>Room:</strong> {cleanRoomId}
        </div>
        <div>
          <strong>You:</strong> {cleanPlayerName}
          {me
            ? ` ${getPlayerTags(me, {
                hostId: state?.hostId ?? "",
                viewerClientId: clientId,
              })
                .filter((tag) => tag.key !== "YOU")
                .map((tag) => `(${tag.label})`)
                .join(" ")}`
            : ""}
        </div>
      </div>

      {isHost && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={hostParticipates}
              disabled={state?.gameStarted === true}
              onChange={(event) => toggleHostParticipation(event.target.checked)}
            />
            Host participates as a player
          </label>
          {state?.gameStarted && (
            <div style={{ marginTop: 4, fontSize: 12, color: "#666" }}>
              Host participation can only be changed before the game starts.
            </div>
          )}
        </div>
      )}

      {state?.settings && !isRoleSelectorRoom && (
        <div style={{ marginBottom: 12, fontSize: 12, color: "#444" }}>
          <div>
            <strong>Settings (server):</strong>
          </div>
          <div>
            roles: mafia {state.settings.roleCount.mafia}, doctor{" "}
            {state.settings.roleCount.doctor}, detective{" "}
            {state.settings.roleCount.detective}, sheriff{" "}
            {state.settings.roleCount.sheriff}
          </div>
        </div>
      )}

      {state && isRoleSelectorRoom && (
        <div
          style={{
            marginBottom: 12,
            border: "1px solid #e7e7e7",
            borderRadius: 10,
            padding: 10,
            fontSize: 13,
            color: "#333",
          }}
        >
          <div style={{ marginBottom: 4 }}>
            <strong>Mode:</strong>{" "}
            {roleSelectorScriptMode === "REGULAR_MAFIA"
              ? "Regular Mafia"
              : "Blood on the Clocktower"}
          </div>
          {roleSelectorScriptMode === "BLOOD_ON_THE_CLOCKTOWER" && (
            <div style={{ marginBottom: 4 }}>
              <strong>Script:</strong>{" "}
              {state.botcScriptSummary
                ? `${state.botcScriptSummary.name} (${state.botcScriptSummary.roleCount} roles)`
                : "Not imported yet"}
            </div>
          )}
          <div style={{ marginBottom: 4 }}>
            <strong>Room lock:</strong>{" "}
            {state.roomLocked ? "Locked (started)" : "Open"}
          </div>
          <div style={{ marginBottom: 4 }}>
            <strong>Redeal:</strong> {allowRoleRedeal ? "Enabled" : "Disabled"}
          </div>
          <div>
            <strong>Configured roles:</strong> mafia {state.settings.roleCount.mafia}, doctor{" "}
            {state.settings.roleCount.doctor}, detective {state.settings.roleCount.detective}, sheriff{" "}
            {state.settings.roleCount.sheriff}
          </div>
        </div>
      )}

      {/* QR code for joining (handy for local play) */}
      {qrDataUrl && state?.hostId === clientId && (
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

      {isHost && (
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          {isRoleSelectorRoom ? (
            <>
              {!state?.gameStarted &&
                <button
                  style={{
                    ...actionButtonStyle,
                    ...(missingBotcScript
                      ? { opacity: 0.65, cursor: "not-allowed" as const }
                      : {}),
                  }}
                  onClick={startRoleSelector}
                  disabled={missingBotcScript}
                  title={
                    missingBotcScript
                      ? "Import a BOCT script first."
                      : undefined
                  }
                >
                  {roleSelectorScriptMode === "BLOOD_ON_THE_CLOCKTOWER"
                    ? "Deal BOCT Roles & Lock Room"
                    : "Deal Roles & Lock Room"}
                </button>}

              {state?.gameStarted && allowRoleRedeal && (
                <button
                  style={actionButtonStyle}
                  onClick={redealRoleSelector}
                >
                  Redeal Roles
                </button>
              )}
            </>
          ) : (
            <>
              <button
                style={actionButtonStyle}
                disabled={!allReady}
                onClick={() => socket.emit("startGame", { roomId: cleanRoomId })}
              >
                Start Game
              </button>

              <button
                style={actionButtonStyle}
                onClick={() =>
                  socket.emit("forceStartGame", { roomId: cleanRoomId })
                }
              >
                Force Start
              </button>
            </>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        {!amSpectator && !isRoleSelectorRoom && (
          <button
            style={readyToggleButtonStyle}
            onClick={toggleReady}
          >
            {amReady ? "Unready" : "Ready"}
          </button>
        )}
        <button
          style={actionButtonStyle}
          onClick={leaveRoom}
        >
          Leave Room
        </button>
      </div>

      {amSpectator && (
        <div style={{ marginBottom: 10, fontSize: 12, color: "#555" }}>
          {isRoleSelectorRoom
            ? "You are dealer-only for this room and will not receive a role."
            : "You are currently spectating and cannot ready up or receive a role."}
        </div>
      )}

      {state && isRoleSelectorRoom && (
        <div
          style={{
            marginBottom: 12,
            border: "1px solid #e0e0e0",
            borderRadius: 10,
            padding: 10,
            background: "#fafafa",
          }}
        >
          {!state.gameStarted && (
            <div style={{ fontSize: 13, color: "#444" }}>
              {roleSelectorScriptMode === "REGULAR_MAFIA"
                ? "Waiting for host to deal roles."
                : state.botcScriptSummary
                ? "BOCT script imported. Waiting for host to deal roles."
                : "Waiting for host to import a BOCT script."}
            </div>
          )}

          {state.gameStarted && isHost && (
            <div style={{ fontSize: 13, color: "#222" }}>
              <div style={{ marginBottom: 6 }}>
                <strong>Host view:</strong> role counts only
              </div>
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
            <div style={{ fontSize: 14, color: "#222" }}>
              <strong>Your role:</strong> {myRoleLabel ?? "Waiting for assignment..."}
              {roleSelectorScriptMode === "BLOOD_ON_THE_CLOCKTOWER" && myRole && (
                <button
                  type="button"
                  onClick={() => setMyRoleInfoOpen(true)}
                  title="Show role details"
                  style={{
                    marginLeft: 8,
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    border: "1px solid #bbb",
                    background: "#fff",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  ?
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ fontWeight: 700, whiteSpace: "pre-wrap", marginBottom: 12 }}>
        {status}
      </div>

      <h3>Players in room:</h3>

      <ul style={{ paddingLeft: 18 }}>
        {(state?.players ?? []).map((p) => {
          const tags = getPlayerTags(p, {
            hostId: state?.hostId ?? "",
            viewerClientId: clientId,
          })
            .map((tag) => `(${tag.label})`)
            .join(" ")

          return (
            <li key={p.clientId} style={{ marginBottom: 6 }}>
              {p.name}
              {tags ? ` ${tags}` : ""}
              {!isRoleSelectorRoom && (
                <>
                  {" - "}
                  Status: {getStatusLabel(p.status)}
                </>
              )}
              {isHost &&
                p.clientId !== state?.hostId &&
                p.clientId !== clientId && (
                  <button
                    style={{ marginLeft: 10 }}
                    onClick={() =>
                      socket.emit("kickPlayer", {
                        roomId: cleanRoomId,
                        targetClientId: p.clientId,
                      })
                    }
                  >
                    Kick
                  </button>
                )}
            </li>
          )
        })}
      </ul>

      {/* Host Settings Modal */}
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
                console.log("DEBUG: saving settings", settings)
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
    </div>
  )
}

