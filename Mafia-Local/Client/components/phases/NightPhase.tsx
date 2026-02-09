import { socket } from "../../src/socket.js"
import type { PhaseScreenProps } from "./types.js"

const SKIP_TARGET_CLIENT_ID = "__SKIP__"

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
          .filter((p) => p.alive && p.isSpectator !== true && p.clientId !== me?.clientId)
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

      {myRole === "MAFIA" && (
        <button onClick={() => act("MAFIA_KILL_VOTE", SKIP_TARGET_CLIENT_ID)}>
          Skip Kill
        </button>
      )}

      {myRole === "DOCTOR" && (
        <button onClick={() => act("DOCTOR_SAVE", SKIP_TARGET_CLIENT_ID)}>
          Skip Save
        </button>
      )}

      {myRole === "DETECTIVE" && (
        <button onClick={() => act("DETECTIVE_CHECK", SKIP_TARGET_CLIENT_ID)}>
          Skip Check
        </button>
      )}
    </div>
  )
}
