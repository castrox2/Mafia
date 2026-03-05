import React, { useEffect, useMemo, useState } from "react"
import { TIMER_MAX_SECONDS, TIMER_MIN_SECONDS } from "../../Shared/events.js"
import type { GameSettings, RoomState } from "../src/types.js"
import "../src/styles/components/settings-modal.css"

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

  useEffect(() => {
    if (!open) return

    setDaySec(s?.timers?.daySec ?? 60)
    setVoteSec(s?.timers?.voteSec ?? 30)
    setNightSec(s?.timers?.nightSec ?? 45)
    setDiscussionSec(s?.timers?.discussionSec ?? 60)
    setPubDiscussionSec(s?.timers?.pubDiscussionSec ?? 30)

    setMafia(s?.roleCount?.mafia ?? 1)
    setDoctor(s?.roleCount?.doctor ?? 0)
    setDetective(s?.roleCount?.detective ?? 0)
    setSheriff(s?.roleCount?.sheriff ?? 0)
  }, [open])

  const handleSave = () => {
    onSave({
      timers: { daySec, voteSec, nightSec, discussionSec, pubDiscussionSec },
      roleCount: { mafia, doctor, detective, sheriff },
    })

    onClose()
  }

  const discardAndClose = () => {
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
    return `Players: ${playerCount}\nThere will always be at least 1 Mafia.`
  }, [playerCount])

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

        <h2 className="settings-modal-title">Host Settings</h2>
        <p className="settings-modal-help">{helpText}</p>

        <div className="settings-modal-grid">
          <section className="settings-modal-section">
            <h3 className="settings-modal-section-title">Timers (seconds)</h3>

            <label className="settings-field settings-row">
              <span>Day:</span>
              <input
                className="settings-field-input"
                type="number"
                value={daySec}
                min={TIMER_MIN_SECONDS}
                max={TIMER_MAX_SECONDS}
                onChange={(event) => setDaySec(Number(event.target.value))}
              />
            </label>

            <label className="settings-field settings-row">
              <span>Vote:</span>
              <input
                className="settings-field-input"
                type="number"
                value={voteSec}
                min={TIMER_MIN_SECONDS}
                max={TIMER_MAX_SECONDS}
                onChange={(event) => setVoteSec(Number(event.target.value))}
              />
            </label>

            <label className="settings-field settings-row">
              <span>Night:</span>
              <input
                className="settings-field-input"
                type="number"
                value={nightSec}
                min={TIMER_MIN_SECONDS}
                max={TIMER_MAX_SECONDS}
                onChange={(event) => setNightSec(Number(event.target.value))}
              />
            </label>

            <label className="settings-field settings-row">
              <span>Discussion:</span>
              <input
                className="settings-field-input"
                type="number"
                value={discussionSec}
                min={TIMER_MIN_SECONDS}
                max={TIMER_MAX_SECONDS}
                onChange={(event) => setDiscussionSec(Number(event.target.value))}
              />
            </label>

            <label className="settings-field settings-row">
              <span>Public Discussion:</span>
              <input
                className="settings-field-input"
                type="number"
                value={pubDiscussionSec}
                min={TIMER_MIN_SECONDS}
                max={TIMER_MAX_SECONDS}
                onChange={(event) => setPubDiscussionSec(Number(event.target.value))}
              />
            </label>
          </section>

          <section className="settings-modal-section">
            <h3 className="settings-modal-section-title">Roles</h3>

            <label className="settings-field settings-row">
              <span>Mafia (min 1):</span>
              <input
                className="settings-field-input"
                type="number"
                value={mafia}
                min={1}
                onChange={(event) => setMafia(Number(event.target.value))}
              />
            </label>

            <label className="settings-field settings-row">
              <span>Doctor (min 0):</span>
              <input
                className="settings-field-input"
                type="number"
                value={doctor}
                min={0}
                onChange={(event) => setDoctor(Number(event.target.value))}
              />
            </label>

            <label className="settings-field settings-row">
              <span>Detective (min 0):</span>
              <input
                className="settings-field-input"
                type="number"
                value={detective}
                min={0}
                onChange={(event) => setDetective(Number(event.target.value))}
              />
            </label>

            <label className="settings-field settings-row">
              <span>Sheriff (min 0):</span>
              <input
                className="settings-field-input"
                type="number"
                value={sheriff}
                min={0}
                onChange={(event) => setSheriff(Number(event.target.value))}
              />
            </label>
          </section>
        </div>

        <div className="settings-actions">
          <button onClick={discardAndClose} className="settings-button" type="button">
            Cancel
          </button>
          <button
            onClick={handleSave}
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
