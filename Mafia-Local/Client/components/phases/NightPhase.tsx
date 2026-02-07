import { socket } from "../../src/socket.js"
import type { PhaseScreenProps } from "./types.js"

export function NightPhase({ state, me, myRole }: PhaseScreenProps) {
  const act = (kind: string, targetClientId: string) => {
    socket.emit("submitRoleAction", {
      roomId: state.roomId,
      kind,
      targetClientId,
    })
  }

  return (
    <div>
      <h2>Night</h2>
      <p>Your role: {myRole ?? "Unknown"}</p>

      <ul>
        {state.players
          .filter((p) => p.alive)
          .map((p) => (
            <li key={p.clientId}>
              {p.name}

              {myRole === "MAFIA" && (
                <button onClick={() => act("MAFIA_KILL_VOTE", p.clientId)}>
                  Kill
                </button>
              )}

              {myRole === "DOCTOR" && (
                <button onClick={() => act("DOCTOR_SAVE", p.clientId)}>
                  Save
                </button>
              )}

              {myRole === "DETECTIVE" && (
                <button onClick={() => act("DETECTIVE_CHECK", p.clientId)}>
                  Investigate
                </button>
              )}
            </li>
          ))}
      </ul>
    </div>
  )
}
