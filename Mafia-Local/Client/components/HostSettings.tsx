import React, { useEffect, useMemo, useState } from "react"
import { TIMER_MAX_SECONDS, TIMER_MIN_SECONDS } from "../../Shared/events.js"
import type { GameSettings, RoomState } from "../src/types.js"

type Props = {
  open: boolean
  roomState: RoomState
  onClose: () => void
  onSave: (settings: GameSettings) => void
}

export default function HostSettingsModal({ open, roomState, onClose, onSave }: Props) {
  const s = roomState.settings

  // Local draft state (only saved when clicking "Save Settings")
  const [daySec, setDaySec] = useState(60)
  const [voteSec, setVoteSec] = useState(30)
  const [nightSec, setNightSec] = useState(45)
  const [discussionSec, setDiscussionSec] = useState(60)
  const [pubDiscussionSec, setPubDiscussionSec] = useState(30)

  const [mafia, setMafia] = useState(1)
  const [doctor, setDoctor] = useState(0)
  const [detective, setDetective] = useState(0)
  const [sheriff, setSheriff] = useState(0)

  // When the modal OPENS, reset draft values to the latest server values
  useEffect(() => {
    if (!open) return

    setDaySec(s?.timers?.daySec ?? 60)
    setVoteSec(s?.timers?.voteSec ?? 30)
    setNightSec(s?.timers?.nightSec ?? 45)
    setDiscussionSec(s?.timers?.discussionSec ?? 60)
    setPubDiscussionSec(s?.timers?.pubDiscussionSec ?? 30)

    // IMPORTANT: roomState.settings uses roleCount (not roles)
    setMafia(s?.roleCount?.mafia ?? 1)
    setDoctor(s?.roleCount?.doctor ?? 0)
    setDetective(s?.roleCount?.detective ?? 0)
    setSheriff(s?.roleCount?.sheriff ?? 0)
  }, [open]) // intentionally only reset when opening

  const handleSave = () => {
    console.log("DEBUG: saving host settings", {
      timers: { daySec, voteSec, nightSec, discussionSec, pubDiscussionSec },
      roleCount: { mafia, doctor, detective, sheriff },
    })

    onSave({
      timers: { daySec, voteSec, nightSec, discussionSec, pubDiscussionSec },
      roleCount: { mafia, doctor, detective, sheriff }, // roleCount ✅
    })

    onClose()
  }

    const discardAndClose = () => {
    console.log("DEBUG: discarding host settings changes")
    // Discard draft by resetting to server values
    setDaySec(s?.timers?.daySec ?? 60)
    setVoteSec(s?.timers?.voteSec ?? 30)
    setNightSec(s?.timers?.nightSec ?? 45)
    setDiscussionSec(s?.timers?.discussionSec ?? 60)
    setPubDiscussionSec(s?.timers?.pubDiscussionSec ?? 30)

    setMafia(s?.roleCount?.mafia ?? 1)
    setDoctor(s?.roleCount?.doctor ?? 0)
    setDetective(s?.roleCount?.detective ?? 0)
    setSheriff(s?.roleCount?.sheriff ?? 0)

    onClose()
  }


  const playerCount = roomState.players.length

  const helpText = useMemo(() => {
    return `Players: ${playerCount}\nThere Will Always Be At Least 1 Mafia.`
  }, [playerCount])

  if (!open) return null

  return (
    <div
      onMouseDown={(e) => {
        // click outside closes (discard changes)
        if (e.target === e.currentTarget) discardAndClose()
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          background: "white",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
          position: "relative",
        }}
      >
        {/* X close */}
        <button
          onClick={discardAndClose}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
            fontSize: 16,
          }}
          aria-label="Close settings"
          title="Close"
        >
          ✕
        </button>

        <h2 style={{ marginTop: 0, marginBottom: 6 }}>Host Settings</h2>
        <pre style={{ marginTop: 0, color: "#444", whiteSpace: "pre-wrap" }}>{helpText}</pre>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Timers (seconds)</h3>

            <label style={{ display: "block", marginBottom: 8 }}>
              Day:
              <input
                type="number"
                value={daySec}
                min={TIMER_MIN_SECONDS}
                max={TIMER_MAX_SECONDS}
                onChange={(e) => setDaySec(Number(e.target.value))}
                style={{ marginLeft: 8, width: 100 }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Vote:
              <input
                type="number"
                value={voteSec}
                min={TIMER_MIN_SECONDS}
                max={TIMER_MAX_SECONDS}
                onChange={(e) => setVoteSec(Number(e.target.value))}
                style={{ marginLeft: 8, width: 100 }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Night:
              <input
                type="number"
                value={nightSec}
                min={TIMER_MIN_SECONDS}
                max={TIMER_MAX_SECONDS}
                onChange={(e) => setNightSec(Number(e.target.value))}
                style={{ marginLeft: 8, width: 100 }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Discussion:
              <input
                type="number"
                value={discussionSec}
                min={TIMER_MIN_SECONDS}
                max={TIMER_MAX_SECONDS}
                onChange={(e) => setDiscussionSec(Number(e.target.value))}
                style={{ marginLeft: 8, width: 100 }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Public Discussion:
              <input
                type="number"
                value={pubDiscussionSec}
                min={TIMER_MIN_SECONDS}
                max={TIMER_MAX_SECONDS}
                onChange={(e) => setPubDiscussionSec(Number(e.target.value))}
                style={{ marginLeft: 8, width: 100 }}
              />
            </label>
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Roles</h3>

            <label style={{ display: "block", marginBottom: 8 }}>
              Mafia (min 1):
              <input
                type="number"
                value={mafia}
                min={1}
                onChange={(e) => setMafia(Number(e.target.value))}
                style={{ marginLeft: 8, width: 100 }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Doctor (min 0):
              <input
                type="number"
                value={doctor}
                min={0}
                onChange={(e) => setDoctor(Number(e.target.value))}
                style={{ marginLeft: 8, width: 100 }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Detective (min 0):
              <input
                type="number"
                value={detective}
                min={0}
                onChange={(e) => setDetective(Number(e.target.value))}
                style={{ marginLeft: 8, width: 100 }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Sheriff (min 0):
              <input
                type="number"
                value={sheriff}
                min={0}
                onChange={(e) => setSheriff(Number(e.target.value))}
                style={{ marginLeft: 8, width: 100 }}
              />
            </label>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button onClick={discardAndClose} style={{ padding: "10px 12px" }}>
            Cancel
          </button>
          <button onClick={handleSave} style={{ padding: "10px 12px", fontWeight: 700 }}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
