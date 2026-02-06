import React from "react"
import type { RoomState } from "../../src/types.js"

type Phase =
    | "LOBBY"
    | "DAY"
    | "DISCUSSION"
    | "PUBDISCUSSION"
    | "VOTING"
    | "NIGHT"
    | "GAMEOVER"

type PhaseRouterProps = {
  phase: RoomState["phase"]
  state: RoomState
  me: RoomState["players"][number] | null
  isHost: boolean
  isSpectator: boolean
}
export const PhaseRouter: React.FC<PhaseRouterProps> = ({
    phase,
    state,
    me,
    isHost,
    isSpectator,
    }) => {
    switch (phase) {
        case "LOBBY":
        return <LobbyScreen state={state} me={me} isHost={isHost} isSpectator={isSpectator} />
        case "DAY":
        return <DayScreen state={state} me={me} isHost={isHost} isSpectator={isSpectator} />
        case "DISCUSSION":
        return <DiscussionScreen state={state} me={me} isHost={isHost} isSpectator={isSpectator} />
        case "PUBDISCUSSION":
        return <PubDiscussionScreen state={state} me={me} isHost={isHost} isSpectator={isSpectator} />
        case "VOTING":
        return <VotingScreen state={state} me={me} isHost={isHost} isSpectator={isSpectator} />
        case "NIGHT":
        return <NightScreen state={state} me={me} isHost={isHost} isSpectator={isSpectator} />
        case "GAMEOVER":
        return <GameOverScreen state={state} me={me} isHost={isHost} isSpectator={isSpectator} />
        default:
        return <div>Unknown phase: {String(phase)}</div>
    }
    }


// --- Minimal placeholder screens (no styling yet) ---
// You can split these into separate files later if you want,
// but keeping them here avoids touching too many files initially.

const LobbyScreen = ({ state, me, isHost }: any) => (
    <div>
        <h2>Lobby</h2>
        <div>Waiting for host to start…</div>
    </div>
)

const DayScreen = ({ state, me, isSpectator }: any) => (
    <div>
        <h2>Day</h2>
        <div>Daytime phase content goes here.</div>
    </div>
)

const DiscussionScreen = ({ state, me }: any) => (
    <div>
        <h2>Discussion</h2>
        <div>Discussion phase content goes here.</div>
    </div>
)

const PubDiscussionScreen = ({ state, me }: any) => (
    <div>
        <h2>Public Discussion</h2>
        <div>Public discussion content goes here.</div>
    </div>
)

const VotingScreen = ({ state, me, isSpectator }: any) => (
    <div>
        <h2>Voting</h2>
        <div>Voting UI goes here.</div>
    </div>
)

const NightScreen = ({ state, me, isSpectator }: any) => (
    <div>
        <h2>Night</h2>
        <div>Night role action UI goes here.</div>
    </div>
)

const GameOverScreen = ({ state, me, isHost }: any) => (
    <div>
        <h2>Game Over</h2>
        <div>Winner + restart options go here.</div>
    </div>
)
