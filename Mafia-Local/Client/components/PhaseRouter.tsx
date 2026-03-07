import React from "react"
import type { RoomState, Player } from "../src/types.js"
import { SKIP_TARGET_CLIENT_ID } from "../../Shared/events.js"
import type {
  MafiaWinner,
  PrivateMessagePayload,
  RoleActionKind,
  YourRolePayload,
} from "../../Shared/events.js"
import {
  getNightActionMetaForRole,
  getPhaseLabel,
  getRoleLabel,
  getWinnerLabel,
} from "../src/uiMeta.js"
import "../src/styles/phases/day.css"

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
type Winner = MafiaWinner
type ActionFeedback = null | { kind: "ACCEPTED" | "REFUSED"; text: string }

type PhaseRouterProps = {
  phase: Phase
  state: RoomState
  me: Player | null
  isHost: boolean
  isSpectator: boolean

  // UI-supporting, non-authoritative (sent by events; roomState is the truth)
  myRole: YourRolePayload["role"] | null
  rolemateClientIds: string[]
  privateMessages: PrivateMessagePayload[]
  banner: Banner
  winner: Winner | null
  actionFeedback: ActionFeedback
  submitRoleAction: (kind: RoleActionKind, targetClientId: string) => void
}

export const PhaseRouter: React.FC<PhaseRouterProps> = ({
  phase,
  state,
  me,
  isHost,
  isSpectator,
  myRole,
  rolemateClientIds,
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
          rolemateClientIds={rolemateClientIds}
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
          rolemateClientIds={rolemateClientIds}
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
          rolemateClientIds={rolemateClientIds}
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
          rolemateClientIds={rolemateClientIds}
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
          rolemateClientIds={rolemateClientIds}
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
          rolemateClientIds={rolemateClientIds}
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
          rolemateClientIds={rolemateClientIds}
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
  myRole: YourRolePayload["role"] | null
  rolemateClientIds: string[]
  privateMessages: PrivateMessagePayload[]
  banner: Banner
  winner: Winner | null
  actionFeedback: ActionFeedback
  submitRoleAction: (kind: RoleActionKind, targetClientId: string) => void
}

const BannerView = ({ banner }: { banner: Banner }) => {
  if (!banner) return null

  const phaseLabel = banner.kind === "NIGHT" ? getPhaseLabel("NIGHT") : getPhaseLabel("VOTING")

  return (
    <div className="phase-banner" style={{ marginBottom: 10, padding: 10, border: "1px solid #ddd" }}>
      <strong>{phaseLabel}:</strong> {banner.text}
    </div>
  )
}

const ActionFeedbackView = ({ actionFeedback }: { actionFeedback: ActionFeedback }) => {
  if (!actionFeedback) return null

  const isRefused = actionFeedback.kind === "REFUSED"
  const borderColor = isRefused ? "#c1121f" : "#2a9d8f"

  return (
    <div className="phase-feedback" style={{ marginBottom: 10, padding: 10, border: `1px solid ${borderColor}` }}>
      <strong>{isRefused ? "Action refused" : "Action recorded"}:</strong> {actionFeedback.text}
    </div>
  )
}

const LobbyScreen = ({ isHost, isSpectator, myRole, banner, actionFeedback }: ScreenProps) => (
  <div>
    <h2>{getPhaseLabel("LOBBY")}</h2>
    <BannerView banner={banner} />
    <ActionFeedbackView actionFeedback={actionFeedback} />
    <div>Waiting for host to start...</div>
    <div style={{ marginTop: 8 }}>
      <div>Host: {isHost ? "Yes" : "No"}</div>
      <div>Spectator: {isSpectator ? "Yes" : "No"}</div>
      <div>My role: {myRole ? getRoleLabel(myRole) : "(unknown yet)"} </div>
    </div>
  </div>
)

const DayScreen = ({ banner, actionFeedback }: ScreenProps) => (
  <section className="phase-day">
    <div className="phase-day__card">
      <h2 className="phase-day__title">{getPhaseLabel("DAY")}</h2>

      <p className="phase-day__subtitle">
        Morning breaks over the town. Share reads, build trust, and get ready for voting.
      </p>

      <BannerView banner={banner} />
      <ActionFeedbackView actionFeedback={actionFeedback} />
    </div>
  </section>
)

const DiscussionScreen = ({ banner, actionFeedback }: ScreenProps) => (
  <div>
    <h2>{getPhaseLabel("DISCUSSION")}</h2>
    <BannerView banner={banner} />
    <ActionFeedbackView actionFeedback={actionFeedback} />
    <div>Discussion phase content goes here.</div>
  </div>
)

const PubDiscussionScreen = ({ banner, actionFeedback }: ScreenProps) => (
  <div>
    <h2>{getPhaseLabel("PUBDISCUSSION")}</h2>
    <BannerView banner={banner} />
    <ActionFeedbackView actionFeedback={actionFeedback} />
    <div>Public discussion content goes here.</div>
  </div>
)

const VotingScreen = ({
  state,
  me,
  isSpectator,
  banner,
  actionFeedback,
  submitRoleAction,
}: ScreenProps) => {
  const actionButtonStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 16,
    borderRadius: 8,
    border: "1px solid #bdbdbd",
    background: "#fff",
    cursor: "pointer",
  }

  const skipVoteButtonStyle: React.CSSProperties = {
    ...actionButtonStyle,
    border: "1px solid #7ea0c4",
    background: "#f3f8ff",
  }

  return (
    <div>
      <h2>{getPhaseLabel("VOTING")}</h2>
      <BannerView banner={banner} />
      <ActionFeedbackView actionFeedback={actionFeedback} />
      <div>Cast your vote or skip this round.</div>

      {!isSpectator && me?.alive === true && (
        <div style={{ marginTop: 10 }}>
          <ul>
            {state.players
              .filter((p) => p.alive && p.isSpectator !== true && p.clientId !== me.clientId)
              .map((p) => (
                <li key={p.clientId} style={{ marginBottom: 8 }}>
                  {p.name}{" "}
                  <button
                    style={actionButtonStyle}
                    onClick={() => submitRoleAction("CIVILIAN_VOTE", p.clientId)}
                  >
                    Vote
                  </button>
                </li>
              ))}
          </ul>

          <button
            style={skipVoteButtonStyle}
            onClick={() => submitRoleAction("CIVILIAN_VOTE", SKIP_TARGET_CLIENT_ID)}
          >
            Skip Vote
          </button>
        </div>
      )}

      {isSpectator && (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
          Spectators can view, but not vote.
        </div>
      )}
    </div>
  )
}

const NightScreen = ({
  state,
  me,
  isSpectator,
  myRole,
  rolemateClientIds,
  banner,
  actionFeedback,
  submitRoleAction,
}: ScreenProps) => {
  const canActAtNight = isSpectator !== true && me?.alive === true
  const aliveTargets = state.players.filter(
    (p) => p.alive && p.isSpectator !== true && p.clientId !== me?.clientId
  )

  const actionByRole = getNightActionMetaForRole(myRole)

  const rolemateSet = new Set(rolemateClientIds)
  const rolemateIconSrc =
    myRole === "MAFIA"
      ? "/assets/icons/Mafia.ico"
      : myRole === "DOCTOR"
        ? "/assets/icons/Doctor.ico"
        : null

  return (
    <div>
      <h2>{getPhaseLabel("NIGHT")}</h2>
      <BannerView banner={banner} />
      <ActionFeedbackView actionFeedback={actionFeedback} />
      <div>Night role action UI goes here.</div>

      <div style={{ marginTop: 10 }}>
        <div>
          <strong>My role:</strong> {myRole ? getRoleLabel(myRole) : "(unknown)"}
        </div>

        {canActAtNight && actionByRole && (
          <div style={{ marginTop: 10 }}>
            <ul>
              {aliveTargets.map((p) => {
                const isRolemate = rolemateSet.has(p.clientId)

                return (
                  <li key={p.clientId}>
                    {p.name}{" "}
                    {isRolemate && rolemateIconSrc && (
                      <img
                        src={rolemateIconSrc}
                        alt={myRole === "MAFIA" ? "Mafia rolemate" : "Doctor rolemate"}
                        style={{ width: 16, height: 16, objectFit: "contain", marginRight: 6 }}
                        onError={(event) => {
                          event.currentTarget.style.display = "none"
                        }}
                      />
                    )}
                    <button onClick={() => submitRoleAction(actionByRole.kind, p.clientId)}>
                      {actionByRole.actionLabel}
                    </button>
                  </li>
                )
              })}
            </ul>

            <button onClick={() => submitRoleAction(actionByRole.kind, SKIP_TARGET_CLIENT_ID)}>
              {actionByRole.skipLabel}
            </button>
          </div>
        )}

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
    <h2>{getPhaseLabel("GAMEOVER")}</h2>
    <BannerView banner={banner} />
    <ActionFeedbackView actionFeedback={actionFeedback} />
    <div>Winner: {getWinnerLabel(winner)}</div>
    <div style={{ marginTop: 8 }}>Host: {isHost ? "Yes" : "No"}</div>
  </div>
)


