import type { PhaseScreenProps } from "./types.js"

export function LobbyPhase({ isHost }: PhaseScreenProps) {
  return (
    <div>
      <h2>Lobby</h2>
      {isHost && <p>You are the host. Configure settings and start the game.</p>}
      {!isHost && <p>Waiting for host to start the game.</p>}
    </div>
  )
}
