import React, { useEffect, useMemo, useState } from "react"
import { socket, clientId } from "../src/socket.js"
import type { RoomState } from "../src/types.js"
import HostSettingsModal from "../components/HostSettings.js"
import { normalizeRoomId } from "../../Shared/events.js"
import type {
  GameStartedPayload,
  HostParticipationRefusedEvent,
  HostParticipationRefusedPayload,
  ReasonPayload,
  RoomIdPayload,
  SetHostParticipationEvent,
  SetHostParticipationPayload,
} from "../../Shared/events.js"
import { getPlayerTags, getStatusLabel } from "../src/uiMeta.js"

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
  const [state, setState] = useState<RoomState | null>(null)
  const [status, setStatus] = useState("")

  const cleanRoomId = useMemo(() => normalizeRoomId(roomId), [roomId])
  const cleanPlayerName = useMemo(() => playerName.trim(), [playerName])

  const isHost = state?.hostId === clientId
  const me = state?.players?.find((p) => p.clientId === clientId) ?? null
  const amSpectator = me?.isSpectator === true
  const hostParticipates = state?.hostParticipates ?? true
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
    const onRoomState = (s: RoomState) => {
      setState(s)
      setStatus(`In room: ${s.roomId}${clientId === s.hostId ? " (Host) " : ""}`)

      // IMPORTANT:
      // If a player joins while a game is already running, they will land in Lobby first.
      // Auto-switch to Game screen once we learn gameStarted=true from roomState.
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

    const onHostParticipationRefused: HostParticipationRefusedEvent = ({
      reason,
    }: HostParticipationRefusedPayload) => {
      alert(reason)
    }

    const onGameStarted = ({ gameNumber }: GameStartedPayload) => {
      setStatus(`Game started! (Game #${gameNumber})`)
      onEnterGame()
    }

    const onKicked = ({ reason }: ReasonPayload & RoomIdPayload) => {
      alert(reason || "You were kicked.")
      onExit()
    }

    socket.on("roomState", onRoomState)
    socket.on("roomClosed", onRoomClosed)
    socket.on("startRefused", onStartRefused)
    socket.on("hostParticipationRefused", onHostParticipationRefused)
    socket.on("gameStarted", onGameStarted)
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

    return () => {
      socket.off("roomState", onRoomState)
      socket.off("roomClosed", onRoomClosed)
      socket.off("startRefused", onStartRefused)
      socket.off("hostParticipationRefused", onHostParticipationRefused)
      socket.off("gameStarted", onGameStarted)
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

  return (
    <div style={{ padding: 20, maxWidth: 700, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <img
          src="/assets/Mafia-Icon.png"
          alt="Mafia Local logo"
          style={{ width: 56, height: 56, objectFit: "contain" }}
          onError={(event) => {
            event.currentTarget.style.display = "none"
          }}
        />
        <h1 style={{ marginBottom: 0, marginTop: 0 }}>Lobby</h1>
      </div>

      {/* Host settings modal */}
      {clientId === state?.hostId && (
        <div>
          <button
            style={{ ...actionButtonStyle, marginBottom: 12 }}
            onClick={() => setSettingsOpen(true)}
          >
            Host Settings
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

      {/* DEBUG: current room settings from server */}
      {state?.settings && (
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
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        {!amSpectator && (
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
          You are currently spectating and cannot ready up or receive a role.
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
              {" - "}
              Status: {getStatusLabel(p.status)}
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
    </div>
  )
}

