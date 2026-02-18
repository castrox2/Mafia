import React, { useEffect, useMemo, useState } from "react"
import type {
  BotcScriptSource,
  BotcScriptSummaryPayload,
  RoleCountPayload,
  RoleSelectorScriptMode,
  RoleSelectorSettingsPayload,
} from "../../Shared/events.js"
import type { RoomState } from "../src/types.js"
import { getRoleLabel } from "../src/uiMeta.js"

type Props = {
  open: boolean
  roomState: RoomState
  botcScriptSummary: BotcScriptSummaryPayload | null
  onClose: () => void
  onSave: (payload: {
    roleCount: RoleCountPayload
    roleSelectorSettings: RoleSelectorSettingsPayload
  }) => void
  onImportBotcScript: (payload: { source: BotcScriptSource; rawJson: string }) => void
}

export default function RoleSelectorSettingsModal({
  open,
  roomState,
  botcScriptSummary,
  onClose,
  onSave,
  onImportBotcScript,
}: Props) {
  const [mafia, setMafia] = useState(1)
  const [doctor, setDoctor] = useState(0)
  const [detective, setDetective] = useState(0)
  const [sheriff, setSheriff] = useState(0)
  const [allowRedeal, setAllowRedeal] = useState(false)
  const [scriptMode, setScriptMode] =
    useState<RoleSelectorScriptMode>("REGULAR_MAFIA")
  const [botcJsonDraft, setBotcJsonDraft] = useState("")
  const [importHint, setImportHint] = useState("")
  const [selectedFileName, setSelectedFileName] = useState("")

  useEffect(() => {
    if (!open) return

    setMafia(roomState.settings.roleCount.mafia)
    setDoctor(roomState.settings.roleCount.doctor)
    setDetective(roomState.settings.roleCount.detective)
    setSheriff(roomState.settings.roleCount.sheriff)

    setAllowRedeal(roomState.roleSelectorSettings?.allowRedeal ?? false)
    setScriptMode(roomState.roleSelectorSettings?.scriptMode ?? "REGULAR_MAFIA")
    setImportHint("")
    setSelectedFileName("")
  }, [open, roomState])

  const roleBounds = roomState.roleBounds
  const activePlayerCount = roomState.players.filter((p) => p.isSpectator !== true).length
  const persistedScriptMode =
    roomState.roleSelectorSettings?.scriptMode ?? "REGULAR_MAFIA"

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

  const importScript = (source: BotcScriptSource, rawJson: string) => {
    const nextRaw = String(rawJson || "").trim()
    if (!nextRaw) {
      setImportHint("Paste or select JSON first.")
      return
    }

    if (persistedScriptMode !== "BLOOD_ON_THE_CLOCKTOWER") {
      setImportHint("Save settings with BOCT mode first, then import.")
      return
    }

    onImportBotcScript({ source, rawJson: nextRaw })
    setImportHint(
      source === "UPLOAD"
        ? "Upload import request sent."
        : "Paste import request sent."
    )
  }

  const onScriptFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedFileName(file.name)
    setImportHint("")

    const reader = new FileReader()
    reader.onload = () => {
      const raw = String(reader.result || "")
      importScript("UPLOAD", raw)
    }
    reader.onerror = () => {
      setImportHint("Could not read that file.")
    }
    reader.readAsText(file)
  }

  if (!open) return null

  const groupedRegularRoles = {
    townsfolk: [
      getRoleLabel("CIVILIAN"),
      getRoleLabel("DOCTOR"),
      getRoleLabel("DETECTIVE"),
      getRoleLabel("SHERIFF"),
    ],
    outsiders: [] as string[],
    minions: [] as string[],
    demons: [getRoleLabel("MAFIA")],
    others: [] as string[],
  }

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
          width: "min(820px, 100%)",
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
              Blood on the Clocktower
            </label>

            <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
              BOCT import is available for script prep. Dealing BOCT roles is not implemented yet.
            </div>

            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={allowRedeal}
                onChange={(e) => setAllowRedeal(e.target.checked)}
              />
              Allow host to redeal and overwrite assignments
            </label>

            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                Available Roles
              </summary>
              <div style={{ marginTop: 8 }}>
                {scriptMode === "REGULAR_MAFIA" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>Townsfolk</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {groupedRegularRoles.townsfolk.map((roleId) => (
                          <li key={`townsfolk:${roleId}`}>{roleId}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>Demons</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {groupedRegularRoles.demons.map((roleId) => (
                          <li key={`demons:${roleId}`}>{roleId}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : botcScriptSummary ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {botcScriptSummary.groupedRoleIds.townsfolk.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Townsfolk</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {botcScriptSummary.groupedRoleIds.townsfolk.map((roleId) => (
                            <li key={`townsfolk:${roleId}`}>{roleId}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {botcScriptSummary.groupedRoleIds.outsiders.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Outsiders</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {botcScriptSummary.groupedRoleIds.outsiders.map((roleId) => (
                            <li key={`outsiders:${roleId}`}>{roleId}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {botcScriptSummary.groupedRoleIds.minions.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Minions</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {botcScriptSummary.groupedRoleIds.minions.map((roleId) => (
                            <li key={`minions:${roleId}`}>{roleId}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {botcScriptSummary.groupedRoleIds.demons.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Demons</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {botcScriptSummary.groupedRoleIds.demons.map((roleId) => (
                            <li key={`demons:${roleId}`}>{roleId}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {botcScriptSummary.groupedRoleIds.others.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Other / Unclassified</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {botcScriptSummary.groupedRoleIds.others.map((roleId) => (
                            <li key={`others:${roleId}`}>{roleId}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#666" }}>
                    Import a BOCT script to view all available script roles.
                  </div>
                )}
              </div>
            </details>

            {scriptMode === "BLOOD_ON_THE_CLOCKTOWER" && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>BOCT Script Import</div>

                <textarea
                  placeholder="Paste BOCT script JSON here..."
                  value={botcJsonDraft}
                  onChange={(event) => setBotcJsonDraft(event.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 130,
                    resize: "vertical",
                    fontFamily: "monospace",
                    fontSize: 12,
                    padding: 8,
                    boxSizing: "border-box",
                  }}
                />

                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button
                    style={{ padding: "8px 10px" }}
                    type="button"
                    onClick={() => importScript("PASTE", botcJsonDraft)}
                  >
                    Import Pasted JSON
                  </button>

                  <label
                    style={{
                      border: "1px solid #ccc",
                      borderRadius: 6,
                      padding: "8px 10px",
                      cursor: "pointer",
                      background: "#fafafa",
                    }}
                  >
                    Upload .json
                    <input
                      type="file"
                      accept=".json,application/json,text/json"
                      style={{ display: "none" }}
                      onChange={onScriptFileSelected}
                    />
                  </label>
                </div>

                {selectedFileName && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#444" }}>
                    Selected file: {selectedFileName}
                  </div>
                )}

                {botcScriptSummary && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#222" }}>
                    Imported: {botcScriptSummary.name} ({botcScriptSummary.roleCount} roles)
                  </div>
                )}

                {importHint && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                    {importHint}
                  </div>
                )}
              </div>
            )}
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
