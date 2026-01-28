import React, { useEffect, useMemo, useState } from "react"
import type { RoomState } from "../src/types.js"

type Props = {
  open: boolean
  roomState: RoomState
  onClose: () => void
  onSave: (settings: any) => void
}

export default function HostSettingsModal({ open, roomState, onClose, onSave }: Props) {
  const s = roomState.settings

  const [daySec, setDaySec] = useState(s?.timers?.daySec ?? 60)
  const [voteSec, setVoteSec] = useState(s?.timers?.voteSec ?? 30)
  const [nightSec, setNightSec] = useState(s?.timers?.nightSec ?? 45)
  const [discussionSec, setDiscussionSec] = useState(s?.timers?.discussionSec ?? 60)
  const [pubDiscussionSec, setPubDiscussionSec] = useState(s?.timers?.pubDiscussionSec ?? 30)

  const [mafia, setMafia] = useState(s?.roles?.mafia ?? 1)
  const [doctor, setDoctor] = useState(s?.roles?.doctor ?? 0)
  const [detective, setDetective] = useState(s?.roles?.detective ?? 0)
  const [sheriff, setSheriff] = useState(s?.roles?.sheriff ?? 0)

  
const handleSave = () => {
    onSave({
        timers: { daySec, voteSec, nightSec, discussionSec, pubDiscussionSec, },
        roleCount: { mafia, doctor, detective, sheriff }, // roleCount ** NOT ROLES **
    })
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
        // click outside closes
        if (e.target === e.currentTarget) onClose()
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
          onClick={onClose}
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
                min={5}
                max={600}
                onChange={(e) => setDaySec(Number(e.target.value))}
                style={{ marginLeft: 8, width: 100 }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Vote:
              <input
                type="number"
                value={voteSec}
                min={5}
                max={600}
                onChange={(e) => setVoteSec(Number(e.target.value))}
                style={{ marginLeft: 8, width: 100 }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Night:
              <input
                type="number"
                value={nightSec}
                min={5}
                max={600}
                onChange={(e) => setNightSec(Number(e.target.value))}
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
          <button onClick={onClose} style={{ padding: "10px 12px" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{ padding: "10px 12px", fontWeight: 700 }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
