import type { RoomState } from "../types.js"

type Phase = RoomState["phase"]

export const PHASE_LABELS: Record<Phase, string> = {
    LOBBY: "Lobby",
    DAY: "Day",
    DISCUSSION: "Discussion",
    PUBDISCUSSION: "Public Discussion",
    VOTING: "Voting",
    NIGHT: "Night",
    GAMEOVER: "Game Over",
}
