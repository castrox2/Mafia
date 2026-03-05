import React from "react"
import "../src/styles/pages/main-menu.css"

type Props = {
  onSelectPlayGame: () => void
  onSelectRoleAssigner: () => void
}

export default function MainMenu({
  onSelectPlayGame,
  onSelectRoleAssigner,
}: Props) {
  return (
    <div className="main-menu-page">
      <header className="main-menu-topbar">
        <div className="main-menu-brand">
          <img
            src="/assets/Mafia-Icon.png"
            alt="Mafia logo"
            className="main-menu-brand-logo"
            onError={(event) => {
              event.currentTarget.style.display = "none"
            }}
          />
          <span className="main-menu-brand-name">Mafia</span>
        </div>
      </header>

      <main className="main-menu-main">
        <h1 className="main-menu-title">Mafia</h1>
        <p className="main-menu-subtitle">Choose how you want to play.</p>

        <section className="main-menu-card">
          <h2 className="main-menu-card-title">Main Menu</h2>
          <p className="main-menu-card-copy">Select a mode to continue.</p>

          <button
            type="button"
            onClick={onSelectPlayGame}
            className="main-menu-button main-menu-button-primary"
            title="Create or join a classic game room"
          >
            <span className="main-menu-button-title">Play Game</span>
            <span className="main-menu-button-copy">
              Create or join a regular Mafia game room.
            </span>
          </button>

          <button
            type="button"
            onClick={onSelectRoleAssigner}
            className="main-menu-button main-menu-button-secondary"
            title="Create or join a role assignment room"
          >
            <span className="main-menu-button-title">Role Assigner</span>
            <span className="main-menu-button-copy">
              Create or join a room focused on role assignment.
            </span>
          </button>
        </section>
      </main>

      <footer className="main-menu-footer">
        (c) {new Date().getFullYear()} MafiaGame. All rights reserved.
      </footer>
    </div>
  )
}
