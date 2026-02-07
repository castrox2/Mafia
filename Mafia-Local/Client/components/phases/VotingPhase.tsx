import { socket } from "../../src/socket.js"
import type { PhaseScreenProps } from "./types.js"

export function VotingPhase({ state, me }: PhaseScreenProps) {
  const vote = (targetClientId: string) => {
    socket.emit("submitRoleAction", {
      roomId: state.roomId,
      kind: "CIVILIAN_VOTE",
      targetClientId,
    })
  }

  return (
    <div>
      <h2>Voting</h2>

      <ul>
        {state.players
          .filter((p) => p.alive && p.clientId !== me?.clientId)
          .map((p) => (
            <li key={p.clientId}>
              {p.name}
              <button onClick={() => vote(p.clientId)}>Vote</button>
            </li>
          ))}
      </ul>
    </div>
  )
}
