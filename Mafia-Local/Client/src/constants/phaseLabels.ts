import type { RoomState } from "../types.js"
import { PHASE_UI_META } from "../uiMeta.js"

type Phase = RoomState["phase"]

export const PHASE_LABELS: Record<Phase, string> = {
    LOBBY: PHASE_UI_META.LOBBY.label,
    DAY: PHASE_UI_META.DAY.label,
    DISCUSSION: PHASE_UI_META.DISCUSSION.label,
    PUBDISCUSSION: PHASE_UI_META.PUBDISCUSSION.label,
    VOTING: PHASE_UI_META.VOTING.label,
    NIGHT: PHASE_UI_META.NIGHT.label,
    GAMEOVER: PHASE_UI_META.GAMEOVER.label,
}
