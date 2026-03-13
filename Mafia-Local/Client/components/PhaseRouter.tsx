import React from "react"
import type { RoomState, Player } from "../src/types.js"
import { SKIP_TARGET_CLIENT_ID } from "../../Shared/events.js"
import VotePanel from "./VotePanel.js"
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
import "../src/styles/phases/discussion.css"
import "../src/styles/phases/night.css"
import "../src/styles/phases/public-discussion.css"

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

type Banner = null | { kind: "NIGHT" | "VOTING" | "PUBLIC"; text: string }
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

const PHASE_PLACEHOLDER_TEXTS = ["PH1", "PH2", "PH3", "PH4", "PH5"] as const
const PHASE_PLACEHOLDER_ROTATE_MS = 4000

const RotatingPhasePlaceholder = ({
  className,
}: {
  className?: string
}) => {
  const [index, setIndex] = React.useState(0)

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % PHASE_PLACEHOLDER_TEXTS.length)
    }, PHASE_PLACEHOLDER_ROTATE_MS)

    return () => window.clearInterval(intervalId)
  }, [])

  return <p className={className}>{PHASE_PLACEHOLDER_TEXTS[index]}</p>
}

const BannerView = ({ banner }: { banner: Banner }) => {
  if (!banner) return null

  const phaseLabel =
    banner.kind === "NIGHT"
      ? getPhaseLabel("NIGHT")
      : banner.kind === "VOTING"
        ? getPhaseLabel("VOTING")
        : "Announcement"

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
  <section className="phase-day phase-message-phase">
    <div className="phase-message-phase__card phase-message-phase__surface">
      <div className="phase-message-phase__alerts">
        <BannerView banner={banner} />
        <ActionFeedbackView actionFeedback={actionFeedback} />
      </div>
      <div className="phase-message-phase__center">
        <RotatingPhasePlaceholder className="phase-message-phase__rotating-text" />
      </div>
    </div>
  </section>
)

const DiscussionScreen = ({ banner, actionFeedback }: ScreenProps) => (
  <section className="phase-day phase-message-phase phase-discussion">
    <div className="phase-message-phase__card phase-message-phase__surface">
      <div className="phase-message-phase__alerts">
        <BannerView banner={banner} />
        <ActionFeedbackView actionFeedback={actionFeedback} />
      </div>
      <img
        className="phase-message-phase__illustration phase-message-phase__illustration--private"
        src="/assets/images/Private%20Discussion.png"
        alt=""
        aria-hidden="true"
      />
      <div className="phase-message-phase__center">
        <RotatingPhasePlaceholder className="phase-message-phase__rotating-text" />
      </div>
    </div>
  </section>
)

const PubDiscussionScreen = ({ banner, actionFeedback }: ScreenProps) => (
  <section className="phase-day phase-message-phase phase-public-discussion">
    <div className="phase-message-phase__card phase-message-phase__surface">
      <div className="phase-message-phase__alerts">
        <BannerView banner={banner} />
        <ActionFeedbackView actionFeedback={actionFeedback} />
      </div>
      <img
        className="phase-message-phase__illustration phase-message-phase__illustration--public"
        src="/assets/images/Public%20Discussion.png"
        alt=""
        aria-hidden="true"
      />
      <div className="phase-message-phase__center">
        <RotatingPhasePlaceholder className="phase-message-phase__rotating-text" />
      </div>
    </div>
  </section>
)

const VotingScreen = ({
  state,
  me,
  isSpectator,
  banner,
  actionFeedback,
  submitRoleAction,
}: ScreenProps) => {
  const voteTargets =
    me == null
      ? []
      : state.players
          .filter((p) => p.alive && p.isSpectator !== true && p.clientId !== me.clientId)
          .map((p) => ({
            clientId: p.clientId,
            name: p.name,
            subtitle: `ID: ${p.clientId}`,
          }))

  return (
    <section className="phase-voting-screen">
      <div className="phase-voting-screen__header">
        <BannerView banner={banner} />
        <ActionFeedbackView actionFeedback={actionFeedback} />
        <p className="phase-voting-screen__description">Cast your vote or skip this round.</p>
      </div>

        {!isSpectator && me?.alive === true && (
          <div className="phase-voting-screen__panel">
            <VotePanel
              className="vote-panel--courtroom"
              title="Vote"
              description="Choose one player to eliminate, or skip if you are not ready to commit."
              targets={voteTargets}
              actionLabel="Vote"
            emptyLabel="No valid players are available to vote for."
            skipLabel="Skip Vote"
            onSelect={(targetClientId) => {
              submitRoleAction("CIVILIAN_VOTE", targetClientId)
            }}
            onSkip={() => {
              submitRoleAction("CIVILIAN_VOTE", SKIP_TARGET_CLIENT_ID)
            }}
          />
        </div>
      )}

      {isSpectator && (
        <div className="phase-voting-screen__spectator-note">
          Spectators can view, but not vote.
        </div>
      )}
    </section>
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
  const actionByRole = getNightActionMetaForRole(myRole)

  const rolemateSet = new Set(rolemateClientIds)
  const rolemateIconSrc =
    myRole === "MAFIA"
      ? "/assets/icons/Mafia.ico"
      : myRole === "DOCTOR"
        ? "/assets/icons/Doctor.ico"
        : null
  const allowSelfTargetAtNight = actionByRole?.kind === "DOCTOR_SAVE"
  const nightTargets =
    canActAtNight && actionByRole
      ? state.players
          .filter(
            (p) =>
              p.alive &&
              p.isSpectator !== true &&
              (allowSelfTargetAtNight || p.clientId !== me?.clientId)
          )
          .map((p) => ({
            clientId: p.clientId,
            name: p.name,
            iconSrc: rolemateSet.has(p.clientId) ? rolemateIconSrc ?? undefined : undefined,
            iconAlt: rolemateSet.has(p.clientId)
              ? myRole === "MAFIA"
                ? "Mafia rolemate"
                : "Doctor rolemate"
              : undefined,
          }))
      : []
  const nightActionCopy =
    actionByRole?.kind === "MAFIA_KILL_VOTE"
      ? {
          title: "Night Kill Vote",
          description: "Choose one player to eliminate, or skip if you want to hold the vote.",
        }
      : actionByRole?.kind === "DOCTOR_SAVE"
        ? {
            title: "Night Save",
            description: "Choose one player to protect tonight, or skip to leave things unchanged.",
          }
        : actionByRole?.kind === "DETECTIVE_CHECK"
          ? {
              title: "Night Investigation",
              description: "Choose one player to investigate tonight, or skip if you do not want to check anyone.",
            }
          : null

  return (
    <section className="phase-night">
      <div className="phase-night__card">
        <div className="phase-night__alerts">
          <BannerView banner={banner} />
          <ActionFeedbackView actionFeedback={actionFeedback} />
        </div>

        <div className="phase-night__body">
          {canActAtNight && actionByRole && nightActionCopy && (
            <div className="phase-night__panel-wrap">
              <VotePanel
                className="vote-panel--night"
                title={nightActionCopy.title}
                description={nightActionCopy.description}
                targets={nightTargets}
                actionLabel={actionByRole.actionLabel}
                emptyLabel="No valid players are available for this action."
                skipLabel={actionByRole.skipLabel}
                onSelect={(targetClientId) => {
                  submitRoleAction(actionByRole.kind, targetClientId)
                }}
                onSkip={() => {
                  submitRoleAction(actionByRole.kind, SKIP_TARGET_CLIENT_ID)
                }}
              />
            </div>
          )}

          {isSpectator && (
            <div className="phase-night__spectator-note">
              Spectators can view, but cannot act at night.
            </div>
          )}
        </div>
      </div>
    </section>
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


