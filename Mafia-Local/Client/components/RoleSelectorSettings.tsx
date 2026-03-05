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
import "../src/styles/components/settings-modal.css"

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
  const [scriptMode, setScriptMode] = useState<RoleSelectorScriptMode>("REGULAR_MAFIA")
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
  const activePlayerCount = roomState.players.filter((player) => !player.isSpectator).length

  const regularAvailableRoles = [
    getRoleLabel("CIVILIAN"),
    getRoleLabel("DOCTOR"),
    getRoleLabel("DETECTIVE"),
    getRoleLabel("SHERIFF"),
    getRoleLabel("MAFIA"),
  ]

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

    if (scriptMode !== "BLOOD_ON_THE_CLOCKTOWER") {
      setImportHint("Switch room mode to Blood on the Clocktower before importing.")
      return
    }

    onImportBotcScript({ source, rawJson: nextRaw })
    setImportHint(
      source === "UPLOAD"
        ? "Upload import request sent. If refused, save settings and retry."
        : "Paste import request sent. If refused, save settings and retry."
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

  return (
    <div
      className="settings-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) discardAndClose()
      }}
    >
      <div className="settings-modal-panel" role="dialog" aria-modal="true">
        <button
          onClick={discardAndClose}
          className="settings-modal-close"
          aria-label="Close settings"
          title="Close"
          type="button"
        >
          X
        </button>

        <h2 className="settings-modal-title">Role Selector Settings</h2>
        <p className="settings-modal-help">{helpText}</p>

        <div className="settings-modal-grid">
          <section className="settings-modal-section">
            <h3 className="settings-modal-section-title">Role Counts</h3>

            <label className="settings-field settings-row">
              <span>
                Mafia ({roleBounds.mafia.min}-{roleBounds.mafia.max}):
              </span>
              <input
                className="settings-field-input"
                type="number"
                value={mafia}
                min={roleBounds.mafia.min}
                max={roleBounds.mafia.max}
                onChange={(event) => setMafia(Number(event.target.value))}
              />
            </label>

            <label className="settings-field settings-row">
              <span>
                Doctor ({roleBounds.doctor.min}-{roleBounds.doctor.max}):
              </span>
              <input
                className="settings-field-input"
                type="number"
                value={doctor}
                min={roleBounds.doctor.min}
                max={roleBounds.doctor.max}
                onChange={(event) => setDoctor(Number(event.target.value))}
              />
            </label>

            <label className="settings-field settings-row">
              <span>
                Detective ({roleBounds.detective.min}-{roleBounds.detective.max}):
              </span>
              <input
                className="settings-field-input"
                type="number"
                value={detective}
                min={roleBounds.detective.min}
                max={roleBounds.detective.max}
                onChange={(event) => setDetective(Number(event.target.value))}
              />
            </label>

            <label className="settings-field settings-row">
              <span>
                Sheriff ({roleBounds.sheriff.min}-{roleBounds.sheriff.max}):
              </span>
              <input
                className="settings-field-input"
                type="number"
                value={sheriff}
                min={roleBounds.sheriff.min}
                max={roleBounds.sheriff.max}
                onChange={(event) => setSheriff(Number(event.target.value))}
              />
            </label>
          </section>

          <section className="settings-modal-section">
            <h3 className="settings-modal-section-title">Mode</h3>

            <label className="settings-choice">
              <input
                type="radio"
                checked={scriptMode === "REGULAR_MAFIA"}
                onChange={() => setScriptMode("REGULAR_MAFIA")}
              />
              <span>Regular Mafia</span>
            </label>

            <label className="settings-choice">
              <input
                type="radio"
                checked={scriptMode === "BLOOD_ON_THE_CLOCKTOWER"}
                onChange={() => setScriptMode("BLOOD_ON_THE_CLOCKTOWER")}
              />
              <span>Blood on the Clocktower</span>
            </label>

            <div className="settings-note">
              BOCT import and scripted role dealing are enabled with standard BOCT distribution rules.
            </div>

            <label className="settings-choice">
              <input
                type="checkbox"
                checked={allowRedeal}
                onChange={(event) => setAllowRedeal(event.target.checked)}
              />
              <span>Allow host to redeal and overwrite assignments</span>
            </label>

            <details className="settings-details">
              <summary>Available Roles</summary>
              <div>
                {scriptMode === "REGULAR_MAFIA" ? (
                  <div>
                    <div className="settings-script-title">Available</div>
                    <ul className="settings-group-list">
                      {regularAvailableRoles.map((roleId) => (
                        <li key={`available:${roleId}`}>{roleId}</li>
                      ))}
                    </ul>
                  </div>
                ) : botcScriptSummary ? (
                  <div className="settings-group-grid">
                    {botcScriptSummary.groupedRoleIds.townsfolk.length > 0 && (
                      <div>
                        <div className="settings-script-title">Townsfolk</div>
                        <ul className="settings-group-list">
                          {botcScriptSummary.groupedRoleIds.townsfolk.map((roleId) => (
                            <li key={`townsfolk:${roleId}`}>{roleId}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {botcScriptSummary.groupedRoleIds.outsiders.length > 0 && (
                      <div>
                        <div className="settings-script-title">Outsiders</div>
                        <ul className="settings-group-list">
                          {botcScriptSummary.groupedRoleIds.outsiders.map((roleId) => (
                            <li key={`outsiders:${roleId}`}>{roleId}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {botcScriptSummary.groupedRoleIds.minions.length > 0 && (
                      <div>
                        <div className="settings-script-title">Minions</div>
                        <ul className="settings-group-list">
                          {botcScriptSummary.groupedRoleIds.minions.map((roleId) => (
                            <li key={`minions:${roleId}`}>{roleId}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {botcScriptSummary.groupedRoleIds.demons.length > 0 && (
                      <div>
                        <div className="settings-script-title">Demons</div>
                        <ul className="settings-group-list">
                          {botcScriptSummary.groupedRoleIds.demons.map((roleId) => (
                            <li key={`demons:${roleId}`}>{roleId}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {botcScriptSummary.groupedRoleIds.others.length > 0 && (
                      <div>
                        <div className="settings-script-title">Other / Unclassified</div>
                        <ul className="settings-group-list">
                          {botcScriptSummary.groupedRoleIds.others.map((roleId) => (
                            <li key={`others:${roleId}`}>{roleId}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="settings-note">
                    Import a BOCT script to view all available script roles.
                  </div>
                )}
              </div>
            </details>

            {scriptMode === "BLOOD_ON_THE_CLOCKTOWER" && (
              <div className="settings-script-area">
                <div className="settings-script-title">BOCT Script Import</div>

                <textarea
                  className="settings-script-textarea"
                  placeholder="Paste BOCT script JSON here..."
                  value={botcJsonDraft}
                  onChange={(event) => setBotcJsonDraft(event.target.value)}
                />

                <div className="settings-script-actions">
                  <button
                    className="settings-button"
                    type="button"
                    onClick={() => importScript("PASTE", botcJsonDraft)}
                  >
                    Import Pasted JSON
                  </button>

                  <label className="settings-upload-label">
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
                  <div className="settings-inline-text">Selected file: {selectedFileName}</div>
                )}

                {botcScriptSummary && (
                  <div className="settings-inline-text">
                    Imported: {botcScriptSummary.name} ({botcScriptSummary.roleCount} roles)
                  </div>
                )}

                {importHint && <div className="settings-inline-text">{importHint}</div>}
              </div>
            )}
          </section>
        </div>

        <div className="settings-actions">
          <button onClick={discardAndClose} className="settings-button" type="button">
            Cancel
          </button>
          <button
            onClick={save}
            className="settings-button settings-button-primary"
            type="button"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
