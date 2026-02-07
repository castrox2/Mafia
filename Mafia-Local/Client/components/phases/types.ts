import type { RoomState, Player } from "../../src/types.js"

export type PhaseScreenProps = {
  state: RoomState
  me: Player | null
  isHost: boolean
  isSpectator: boolean

  // UI-only helpers
  myRole: string | null
  myActions: any[]
  privateMessages: any[]
  banner: null | { kind: "NIGHT" | "VOTE"; text: string }
}
