import React from "react"
import type { RoomState, Player } from "../src/types.js"

/* ======================================================
                    PhaseRouter.tsx
  Central "screen switch" for each game phase.

  IMPORTANT DESIGN RULES:
  - This file contains NO game logic.
  - This file contains NO Socket.IO calls.
  - This file contains NO phase scheduling.
  - It only decides which "phase screen" to render + passes UI data through.

  WHY:
  - Keeps styling/components isolated per phase.
  - Makes it easy for UI teammate to animate transitions per screen.
====================================================== */

type Phase = RoomState["phase"]

type Banner = null | { kind: "NIGHT" | "VOTING"; text: string }
type Winner = "MAFIA" | "CIVILIANS"
type ActionFeedback = null | { kind: "ACCEPTED" | "REFUSED"; text: string }
const SKIP_TARGET_CLIENT_ID = "__SKIP__"

type PhaseRouterProps = {
  phase: Phase
  state: RoomState
  me: Player | null
  isHost: boolean
  isSpectator: boolean

  // UI-supporting, non-authoritative (sent by events; roomState is the truth)
  myRole: string | null
  myActions: Array<{ kind: string; targetClientId: string; createdAtMs: number }>
  privateMessages: any[]
  banner: Banner
  winner: Winner | null
  actionFeedback: ActionFeedback
  submitRoleAction: (kind: string, targetClientId: string) => void
}

export const PhaseRouter: React.FC<PhaseRouterProps> = ({
  phase,
  state,
  me,
  isHost,
  isSpectator,
  myRole,
  myActions,
  privateMessages,
  banner,
  winner,
  actionFeedback,
  submitRoleAction,
}) => {
  switch (phase) {
    case "LOBBY":
      return (
        <LobbyScreen
          state={state}
          me={me}
          isHost={isHost}
          isSpectator={isSpectator}
          myRole={myRole}
          myActions={myActions}
          privateMessages={privateMessages}
          banner={banner}
          winner={winner}
          actionFeedback={actionFeedback}
          submitRoleAction={submitRoleAction}
        />
      )

    case "DAY":
      return (
        <DayScreen
          state={state}
          me={me}
          isHost={isHost}
          isSpectator={isSpectator}
          myRole={myRole}
          myActions={myActions}
          privateMessages={privateMessages}
          banner={banner}
          winner={winner}
          actionFeedback={actionFeedback}
          submitRoleAction={submitRoleAction}
        />
      )

    case "DISCUSSION":
      return (
        <DiscussionScreen
          state={state}
          me={me}
          isHost={isHost}
          isSpectator={isSpectator}
          myRole={myRole}
          myActions={myActions}
          privateMessages={privateMessages}
          banner={banner}
          winner={winner}
          actionFeedback={actionFeedback}
          submitRoleAction={submitRoleAction}
        />
      )

    case "PUBDISCUSSION":
      return (
        <PubDiscussionScreen
          state={state}
          me={me}
          isHost={isHost}
          isSpectator={isSpectator}
          myRole={myRole}
          myActions={myActions}
          privateMessages={privateMessages}
          banner={banner}
          winner={winner}
          actionFeedback={actionFeedback}
          submitRoleAction={submitRoleAction}
        />
      )

    case "VOTING":
      return (
        <VotingScreen
          state={state}
          me={me}
          isHost={isHost}
          isSpectator={isSpectator}
          myRole={myRole}
          myActions={myActions}
          privateMessages={privateMessages}
          banner={banner}
          winner={winner}
          actionFeedback={actionFeedback}
          submitRoleAction={submitRoleAction}
        />
      )

    case "NIGHT":
      return (
        <NightScreen
          state={state}
          me={me}
          isHost={isHost}
          isSpectator={isSpectator}
          myRole={myRole}
          myActions={myActions}
          privateMessages={privateMessages}
          banner={banner}
          winner={winner}
          actionFeedback={actionFeedback}
          submitRoleAction={submitRoleAction}
        />
      )

    case "GAMEOVER":
      return (
        <GameOverScreen
          state={state}
          me={me}
          isHost={isHost}
          isSpectator={isSpectator}
          myRole={myRole}
          myActions={myActions}
          privateMessages={privateMessages}
          banner={banner}
          winner={winner}
          actionFeedback={actionFeedback}
          submitRoleAction={submitRoleAction}
        />
      )

    default:
      return <div>Unknown phase: {String(phase)}</div>
  }
}

/* ======================================================
            Minimal placeholder screens (no styling yet)
  - Keep these dumb.
  - UI teammate can split into separate files later.
====================================================== */

type ScreenProps = {
  state: RoomState
  me: Player | null
  isHost: boolean
  isSpectator: boolean
  myRole: string | null
  myActions: Array<{ kind: string; targetClientId: string; createdAtMs: number }>
  privateMessages: any[]
  banner: Banner
  winner: Winner | null
  actionFeedback: ActionFeedback
  submitRoleAction: (kind: string, targetClientId: string) => void
}

const BannerView = ({ banner }: { banner: Banner }) => {
  if (!banner) return null
  return (
    <div style={{ marginBottom: 10, padding: 10, border: "1px solid #ddd" }}>
      <strong>{banner.kind === "NIGHT" ? "Night" : "Voting"}:</strong> {banner.text}
    </div>
  )
}

const ActionFeedbackView = ({ actionFeedback }: { actionFeedback: ActionFeedback }) => {
  if (!actionFeedback) return null

  const isRefused = actionFeedback.kind === "REFUSED"
  const borderColor = isRefused ? "#c1121f" : "#2a9d8f"

  return (
    <div style={{ marginBottom: 10, padding: 10, border: `1px solid ${borderColor}` }}>
      <strong>{isRefused ? "Action refused" : "Action recorded"}:</strong> {actionFeedback.text}
    </div>
  )
}

const LobbyScreen = ({ isHost, isSpectator, myRole, banner, actionFeedback }: ScreenProps) => (
  <div>
    <h2>Lobby</h2>
    <BannerView banner={banner} />
    <ActionFeedbackView actionFeedback={actionFeedback} />
    <div>Waiting for host to start…</div>
    <div style={{ marginTop: 8 }}>
      <div>Host: {isHost ? "Yes" : "No"}</div>
      <div>Spectator: {isSpectator ? "Yes" : "No"}</div>
      <div>My role: {myRole ?? "(unknown yet)"} </div>
    </div>
  </div>
)

const DayScreen = ({ isSpectator, myRole, banner, actionFeedback }: ScreenProps) => (
  <div>
    <h2>Day</h2>
    <BannerView banner={banner} />
    <ActionFeedbackView actionFeedback={actionFeedback} />
    <div>Daytime phase content goes here.</div>
    <div style={{ marginTop: 8 }}>
      <div>Spectator: {isSpectator ? "Yes" : "No"}</div>
      <div>My role: {myRole ?? "(unknown)"} </div>
    </div>
  </div>
)

const DiscussionScreen = ({ banner, actionFeedback }: ScreenProps) => (
  <div>
    <h2>Discussion</h2>
    <BannerView banner={banner} />
    <ActionFeedbackView actionFeedback={actionFeedback} />
    <div>Discussion phase content goes here.</div>
  </div>
)

const PubDiscussionScreen = ({ banner, actionFeedback }: ScreenProps) => (
  <div>
    <h2>Public Discussion</h2>
    <BannerView banner={banner} />
    <ActionFeedbackView actionFeedback={actionFeedback} />
    <div>Public discussion content goes here.</div>
  </div>
)

const VotingScreen = ({
  state,
  me,
  isSpectator,
  myActions,
  banner,
  actionFeedback,
  submitRoleAction,
}: ScreenProps) => (
  <div>
    <h2>Voting</h2>
    <BannerView banner={banner} />
    <ActionFeedbackView actionFeedback={actionFeedback} />
    <div>Cast your vote or skip this round.</div>

    {!isSpectator && me?.alive === true && (
      <div style={{ marginTop: 10 }}>
        <ul>
          {state.players
            .filter((p) => p.alive && p.isSpectator !== true && p.clientId !== me.clientId)
            .map((p) => (
              <li key={p.clientId}>
                {p.name}{" "}
                <button onClick={() => submitRoleAction("CIVILIAN_VOTE", p.clientId)}>Vote</button>
              </li>
            ))}
        </ul>

        <button onClick={() => submitRoleAction("CIVILIAN_VOTE", SKIP_TARGET_CLIENT_ID)}>
          Skip Vote
        </button>
      </div>
    )}

    <div style={{ marginTop: 10 }}>
      <strong>My recorded action(s):</strong>
      <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(myActions, null, 2)}</pre>
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        (UI teammate: use this to pre-select the player you voted for.)
      </div>
    </div>

    {isSpectator && (
      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
        Spectators can view, but not vote.
      </div>
    )}
  </div>
)

const NightScreen = ({
  state,
  me,
  isSpectator,
  myRole,
  myActions,
  privateMessages,
  banner,
  actionFeedback,
  submitRoleAction,
}: ScreenProps) => {
  const canActAtNight = isSpectator !== true && me?.alive === true
  const aliveTargets = state.players.filter(
    (p) => p.alive && p.isSpectator !== true && p.clientId !== me?.clientId
  )

  const actionByRole =
    myRole === "MAFIA"
      ? { kind: "MAFIA_KILL_VOTE", actionLabel: "Kill", skipLabel: "Skip Kill" }
      : myRole === "DOCTOR"
        ? { kind: "DOCTOR_SAVE", actionLabel: "Save", skipLabel: "Skip Save" }
        : myRole === "DETECTIVE"
          ? { kind: "DETECTIVE_CHECK", actionLabel: "Investigate", skipLabel: "Skip Check" }
          : null

  return (
    <div>
      <h2>Night</h2>
      <BannerView banner={banner} />
      <ActionFeedbackView actionFeedback={actionFeedback} />
      <div>Night role action UI goes here.</div>

      <div style={{ marginTop: 10 }}>
        <div>
          <strong>My role:</strong> {myRole ?? "(unknown)"}
        </div>

        {canActAtNight && actionByRole && (
          <div style={{ marginTop: 10 }}>
            <ul>
              {aliveTargets.map((p) => (
                <li key={p.clientId}>
                  {p.name}{" "}
                  <button onClick={() => submitRoleAction(actionByRole.kind, p.clientId)}>
                    {actionByRole.actionLabel}
                  </button>
                </li>
              ))}
            </ul>

            <button onClick={() => submitRoleAction(actionByRole.kind, SKIP_TARGET_CLIENT_ID)}>
              {actionByRole.skipLabel}
            </button>
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <strong>My recorded NIGHT action(s):</strong>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(myActions, null, 2)}</pre>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            (UI teammate: use this to pre-select the target I chose.)
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <strong>Private messages:</strong>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(privateMessages, null, 2)}</pre>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            (Detective results should appear here; later turn into a modal/toast.)
          </div>
        </div>

        {isSpectator && (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
            Spectators can view, but cannot act at night.
          </div>
        )}
      </div>
    </div>
  )
}

const GameOverScreen = ({ isHost, banner, winner, actionFeedback }: ScreenProps) => (
  <div>
    <h2>Game Over</h2>
    <BannerView banner={banner} />
    <ActionFeedbackView actionFeedback={actionFeedback} />
    <div>Winner: {winner ?? "(pending)"}</div>
    <div style={{ marginTop: 8 }}>Host: {isHost ? "Yes" : "No"}</div>
  </div>
)
