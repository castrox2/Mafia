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
  const [howToPlayOpen, setHowToPlayOpen] = React.useState(false)

  React.useEffect(() => {
    if (!howToPlayOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHowToPlayOpen(false)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [howToPlayOpen])

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

          <button
            type="button"
            className="main-menu-howto-button"
            onClick={() => setHowToPlayOpen(true)}
          >
            How to Play
          </button>
        </section>
      </main>

      <footer className="main-menu-footer">
        (c) {new Date().getFullYear()} MafiaGame. All rights reserved.
      </footer>

      {howToPlayOpen && (
        <div
          className="main-menu-modal-backdrop"
          role="presentation"
          onClick={() => setHowToPlayOpen(false)}
        >
          <div
            className="main-menu-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-to-play-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="main-menu-modal__header">
              <div>
                <h2 id="how-to-play-title" className="main-menu-modal__title">
                  How to Play
                </h2>
                <p className="main-menu-modal__copy">
                  A simple guide for classic Mafia and the Role Assigner.
                </p>
              </div>

              <button
                type="button"
                className="main-menu-modal__close"
                onClick={() => setHowToPlayOpen(false)}
                aria-label="Close how to play"
              >
                ×
              </button>
            </div>

            <div className="main-menu-modal__body">
              <section className="main-menu-modal__section">
                <h3 className="main-menu-modal__section-title">Classic Mafia</h3>
                <p className="main-menu-modal__section-copy">
                  Think of this game like hide and seek with talking. One team is trying to
                  trick everyone, and the other team is trying to figure out who is lying.
                </p>
                <ul className="main-menu-modal__list">
                  <li>Mafia tries to kill players at night.</li>
                  <li>Civilians try to talk, think, and vote the Mafia out.</li>
                  <li>Doctors can protect one player at night.</li>
                  <li>Detectives can check one player at night.</li>
                  <li>Sheriffs can use a special day action one time.</li>
                </ul>
              </section>

              <section className="main-menu-modal__section">
                <h3 className="main-menu-modal__section-title">Classic Mafia Flow</h3>
                <ol className="main-menu-modal__list main-menu-modal__list--ordered">
                  <li>Night happens. Special roles do their secret actions.</li>
                  <li>Day starts. Everyone sees what happened.</li>
                  <li>Players talk and share what they think.</li>
                  <li>Voting happens. Everyone chooses who should be removed.</li>
                  <li>The game repeats until the Mafia is gone or the Mafia matches the town.</li>
                </ol>
              </section>

              <section className="main-menu-modal__section">
                <h3 className="main-menu-modal__section-title">Role Assigner</h3>
                <p className="main-menu-modal__section-copy">
                  This room is like a dealer table. It does not run the full game. It only helps
                  hand out roles so your group can play the way you want.
                </p>
                <ul className="main-menu-modal__list">
                  <li>The host opens the room and picks what kind of role setup to use.</li>
                  <li>Players join the room and only see their own role.</li>
                  <li>The host can add, remove, or auto-fill roles before dealing them.</li>
                  <li>If the room starts, it locks so late players cannot jump in.</li>
                  <li>If someone reconnects, they keep the same role they already had.</li>
                </ul>
              </section>

              <section className="main-menu-modal__section">
                <h3 className="main-menu-modal__section-title">BOCT Importer</h3>
                <p className="main-menu-modal__section-copy">
                  If you want to use Blood on the Clocktower scripts, the host can import a script
                  file or paste script JSON into the Role Assigner.
                </p>
                <ul className="main-menu-modal__list">
                  <li>Import the script first so the room knows which roles are available.</li>
                  <li>The room can group roles by townsfolk, outsiders, minions, and demons.</li>
                  <li>Players can view the possible roles without seeing who got what.</li>
                  <li>This is helpful when you want the script ready before your real game starts.</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
