import { socket } from "../../src/socket.js"
import type { PhaseScreenProps } from "./types.js"

export function DayPhase({ state, me, myRole }: PhaseScreenProps) {
  const canShoot = myRole === "SHERIFF"

  const shoot = (targetClientId: string) => {
    socket.emit("submitRoleAction", {
      roomId: state.roomId,
      kind: "SHERIFF_SHOOT",
      targetClientId,
    })
  }

  return (
    <div>
      <h2>Day</h2>

      {canShoot && <p>You may shoot once during the day.</p>}

      <ul>
        {state.players
          .filter((p) => p.alive && p.clientId !== me?.clientId)
          .map((p) => (
            <li key={p.clientId}>
              {p.name}
              {canShoot && (
                <button onClick={() => shoot(p.clientId)}>Shoot</button>
              )}
            </li>
          ))}
      </ul>
    </div>
  )
}
