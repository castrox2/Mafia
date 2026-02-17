import React, { useEffect, useMemo, useState } from "react"
import type {
  RoleCountPayload,
  RoleSelectorScriptMode,
  RoleSelectorSettingsPayload,
} from "../../Shared/events.js"
import type { RoomState } from "../src/types.js"

type Props = {
  open: boolean
  roomState: RoomState
  onClose: () => void
  onSave: (payload: {
    roleCount: RoleCountPayload
    roleSelectorSettings: RoleSelectorSettingsPayload
  }) => void
}

export default function RoleSelectorSettingsModal({
  open,
  roomState,
  onClose,
  onSave,
}: Props) {
  const [mafia, setMafia] = useState(1)
  const [doctor, setDoctor] = useState(0)
  const [detective, setDetective] = useState(0)
  const [sheriff, setSheriff] = useState(0)
  const [allowRedeal, setAllowRedeal] = useState(false)
  const [scriptMode, setScriptMode] =
    useState<RoleSelectorScriptMode>("REGULAR_MAFIA")

  useEffect(() => {
    if (!open) return

    setMafia(roomState.settings.roleCount.mafia)
    setDoctor(roomState.settings.roleCount.doctor)
    setDetective(roomState.settings.roleCount.detective)
    setSheriff(roomState.settings.roleCount.sheriff)

    setAllowRedeal(roomState.roleSelectorSettings?.allowRedeal ?? false)
    setScriptMode(roomState.roleSelectorSettings?.scriptMode ?? "REGULAR_MAFIA")
  }, [open, roomState])

  const roleBounds = roomState.roleBounds
  const activePlayerCount = roomState.players.filter((p) => p.isSpectator !== true).length

  const helpText = useMemo(
    () =>
      [
        `Active players: ${activePlayerCount}`,
        "Unfilled slots become Civilians automatically.",
      ].join("\n"),
    [activePlayerCount]
  )

  const save = () => {
    onSave({
      roleCount: { mafia, doctor, detective, sheriff },
      roleSelectorSettings: {
        scriptMode,
        allowRedeal,
      },
    })
    onClose()
  }

  const discardAndClose = () => {
    onClose()
  }

  if (!open) return null

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) discardAndClose()
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
          X
        </button>

        <h2 style={{ marginTop: 0, marginBottom: 6 }}>Role Selector Settings</h2>
        <pre style={{ marginTop: 0, color: "#444", whiteSpace: "pre-wrap" }}>{helpText}</pre>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Role Counts</h3>

            <label style={{ display: "block", marginBottom: 8 }}>
              Mafia ({roleBounds.mafia.min}-{roleBounds.mafia.max}):
              <input
                type="number"
                value={mafia}
                min={roleBounds.mafia.min}
                max={roleBounds.mafia.max}
                onChange={(e) => setMafia(Number(e.target.value))}
                style={{ marginLeft: 8, width: 100 }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Doctor ({roleBounds.doctor.min}-{roleBounds.doctor.max}):
              <input
                type="number"
                value={doctor}
                min={roleBounds.doctor.min}
                max={roleBounds.doctor.max}
                onChange={(e) => setDoctor(Number(e.target.value))}
                style={{ marginLeft: 8, width: 100 }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Detective ({roleBounds.detective.min}-{roleBounds.detective.max}):
              <input
                type="number"
                value={detective}
                min={roleBounds.detective.min}
                max={roleBounds.detective.max}
                onChange={(e) => setDetective(Number(e.target.value))}
                style={{ marginLeft: 8, width: 100 }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Sheriff ({roleBounds.sheriff.min}-{roleBounds.sheriff.max}):
              <input
                type="number"
                value={sheriff}
                min={roleBounds.sheriff.min}
                max={roleBounds.sheriff.max}
                onChange={(e) => setSheriff(Number(e.target.value))}
                style={{ marginLeft: 8, width: 100 }}
              />
            </label>
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Mode</h3>

            <label style={{ display: "block", marginBottom: 8 }}>
              <input
                type="radio"
                checked={scriptMode === "REGULAR_MAFIA"}
                onChange={() => setScriptMode("REGULAR_MAFIA")}
              />{" "}
              Regular Mafia
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              <input
                type="radio"
                checked={scriptMode === "BLOOD_ON_THE_CLOCKTOWER"}
                onChange={() => setScriptMode("BLOOD_ON_THE_CLOCKTOWER")}
              />{" "}
              Blood on the Clocktower (placeholder)
            </label>

            <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
              Blood on the Clocktower scripts are UI-only for now and do not change behavior yet.
            </div>

            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={allowRedeal}
                onChange={(e) => setAllowRedeal(e.target.checked)}
              />
              Allow host to redeal and overwrite assignments
            </label>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button onClick={discardAndClose} style={{ padding: "10px 12px" }}>
            Cancel
          </button>
          <button onClick={save} style={{ padding: "10px 12px", fontWeight: 700 }}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
