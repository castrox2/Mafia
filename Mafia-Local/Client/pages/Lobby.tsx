import React, { useEffect, useMemo, useState } from "react"
import { socket, clientId } from "../src/socket.js"
import type { RoomState } from "../src/types.js"
import HostSettingsModal from "../components/HostSettings.js"

type Props = {
  roomId: string
  playerName: string
  joinUrl: string
  qrDataUrl: string
  onExit: () => void
}

export default function Lobby({ roomId, playerName, joinUrl, qrDataUrl, onExit }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [state, setState] = useState<RoomState | null>(null)
  const [status, setStatus] = useState("")

  const cleanRoomId = useMemo(() => roomId.trim().toUpperCase(), [roomId])
  const cleanPlayerName = useMemo(() => playerName.trim(), [playerName])

  const isHost = state?.hostId === clientId
  const allReady =
    (state?.players ?? []).length > 0 && (state?.players ?? []).every((p) => p.status === "READY")

  /* ------------------------------------------------------
        Local "now" clock for countdown UI
    - Keeps UI in sync without asking server repeatedly
    - DO NOT use nested intervals (causes leaks / weird behavior)
  ------------------------------------------------------ */
  const [nowMs, setNowMs] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 500)
    return () => clearInterval(t)
  }, [])

  /* ------------------------------------------------------
        Countdown (derived)
    - phaseEndTime should be a server-provided epoch ms timestamp
    - remainingSec updates whenever `state` or `nowMs` changes
  ------------------------------------------------------ */
  const remainingSec =
    state?.phaseEndTime != null
      ? Math.max(0, Math.ceil((state.phaseEndTime - nowMs) / 1000))
      : null

  useEffect(() => {
    const onRoomState = (s: RoomState) => {
      setState(s)
      setStatus(`In room: ${s.roomId}${clientId === s.hostId ? " (Host) " : ""}`)
    }

    const onRoomClosed = ({ roomId: closedRoomId }: { roomId: string }) => {
      if (closedRoomId === cleanRoomId) {
        alert("Room was closed by the host.")
        onExit()
      }
    }

    const onStartRefused = ({ reason }: { reason: string }) => {
      alert(reason)
    }

    const onGameStarted = ({ gameNumber }: { gameNumber: number }) => {
      setStatus(`Game started! (Game #${gameNumber})`)
    }

    const onKicked = ({ reason }: { reason: string }) => {
      alert(reason || "You were kicked.")
      onExit()
    }

    socket.on("roomState", onRoomState)
    socket.on("roomClosed", onRoomClosed)
    socket.on("startRefused", onStartRefused)
    socket.on("gameStarted", onGameStarted)
    socket.on("kicked", onKicked)

    /// If user navigates here directly, make sure we joined
    // IMPORTANT (reconnect-safe):
    // When resuming after refresh, the server may have already reattached this client.
    // In that case, skip this one-time auto-join to avoid duplicate player entries.
    const skipAutoJoin = window.sessionStorage.getItem("mafia_skip_lobby_autojoin") === "1"
    if (skipAutoJoin) {
      window.sessionStorage.removeItem("mafia_skip_lobby_autojoin")
    } else if (cleanRoomId && cleanPlayerName) {
      socket.emit("joinRoom", { roomId: cleanRoomId, playerName: cleanPlayerName })
    }

    return () => {
      socket.off("roomState", onRoomState)
      socket.off("roomClosed", onRoomClosed)
      socket.off("startRefused", onStartRefused)
      socket.off("gameStarted", onGameStarted)
      socket.off("kicked", onKicked)
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
      playerId: clientId,
      status: ready ? "READY" : "NOT READY",
    })
  }

  return (
    <div style={{ padding: 20, maxWidth: 700, fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>Lobby</h1>

      {/* Host settings modal */}
      {clientId === state?.hostId && (
        <div>
          <button
            style={{ padding: "10px 12px", fontSize: 16, marginBottom: 12 }}
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

      {/* DEBUG: current room settings from server */}
      {state?.settings && (
        <div style={{ marginBottom: 12, fontSize: 12, color: "#444" }}>
          <div>
            <strong>Settings (server):</strong>
          </div>
          <div>
            roles: mafia {state.settings.roleCount.mafia}, doctor {state.settings.roleCount.doctor},
            detective {state.settings.roleCount.detective}, sheriff {state.settings.roleCount.sheriff}
          </div>
        </div>
      )}

      {/* QR code for joining (handy for local play) */}
      {qrDataUrl && state?.hostId === clientId && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Scan to join this room:</div>

          <img src={qrDataUrl} alt="Room QR Code" style={{ width: 220, height: 220 }} />

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
            style={{ padding: "10px 12px", fontSize: 16 }}
            disabled={!allReady}
            onClick={() => socket.emit("startGame", { roomId: cleanRoomId })}
          >
            Start Game
          </button>

          <button
            style={{ padding: "10px 12px", fontSize: 16 }}
            onClick={() => socket.emit("forceStartGame", { roomId: cleanRoomId })}
          >
            Force Start
          </button>
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

      <div style={{ fontWeight: 700, whiteSpace: "pre-wrap", marginBottom: 12 }}>{status}</div>

      <h3>Players in room:</h3>

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
              role: {p.role}
              {" — "}
              status: {p.status}
              {isHost && p.clientId !== state?.hostId && p.clientId !== clientId && (
                <button
                  style={{ marginLeft: 10 }}
                  onClick={() =>
                    socket.emit("kickPlayer", { roomId: cleanRoomId, targetClientId: p.clientId })
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
