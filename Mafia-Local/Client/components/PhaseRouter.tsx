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
import "../src/styles/phases/gameover.css"
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
  leaveRoom: () => void
  backToLobby: () => void
  startNewGame: () => void
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
  leaveRoom,
  backToLobby,
  startNewGame,
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
          leaveRoom={leaveRoom}
          backToLobby={backToLobby}
          startNewGame={startNewGame}
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
          leaveRoom={leaveRoom}
          backToLobby={backToLobby}
          startNewGame={startNewGame}
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
          leaveRoom={leaveRoom}
          backToLobby={backToLobby}
          startNewGame={startNewGame}
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
          leaveRoom={leaveRoom}
          backToLobby={backToLobby}
          startNewGame={startNewGame}
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
          leaveRoom={leaveRoom}
          backToLobby={backToLobby}
          startNewGame={startNewGame}
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
          leaveRoom={leaveRoom}
          backToLobby={backToLobby}
          startNewGame={startNewGame}
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
          leaveRoom={leaveRoom}
          backToLobby={backToLobby}
          startNewGame={startNewGame}
        />
      )

    default:
      return <div>Unknown phase: {String(phase)}</div>
  }
}

/* ======================================================
                  Phase screen components
  - Keep these presentation-focused.
  - They can still be split into separate files later.
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
  leaveRoom: () => void
  backToLobby: () => void
  startNewGame: () => void
}

const DAY_PHASE_PLACEHOLDER_TEXTS = [
  "The town wakes up and everyone starts watching each other closely.",
  "Listen carefully. One small slip can change the whole game.",
  "This is the best time to read reactions and notice who feels nervous.",
  "Talk through what happened, but do not trust every confident voice.",
  "Someone is hiding something. The hard part is proving who it is.",
  "Pay attention to who speaks first, who stays quiet, and who changes their story.",
] as const
const DISCUSSION_PHASE_PLACEHOLDER_TEXTS = [
  "Use this time to compare stories and look for anything that does not match.",
  "Good information is shared carefully. Bad information is shared loudly.",
  "Ask simple questions, listen to the answers, and notice who avoids details.",
  "Quiet conversations can reveal more than a loud accusation ever will.",
  "Trust should be earned here, not handed out too quickly.",
  "The smallest detail from one player can expose a bigger lie from another.",
] as const
const PHASE_PLACEHOLDER_ROTATE_MS = 4000

const getRandomPlaceholderIndex = (
  length: number,
  previousIndex?: number
): number => {
  if (length <= 0) return 0
  if (length === 1) return 0

  let nextIndex = Math.floor(Math.random() * length)
  while (nextIndex === previousIndex) {
    nextIndex = Math.floor(Math.random() * length)
  }

  return nextIndex
}

const RotatingPhasePlaceholder = ({
  className,
  texts,
}: {
  className?: string
  texts: readonly string[]
}) => {
  const [index, setIndex] = React.useState(() => getRandomPlaceholderIndex(texts.length))

  React.useEffect(() => {
    setIndex(getRandomPlaceholderIndex(texts.length))
  }, [texts])

  React.useEffect(() => {
    if (texts.length <= 1) return

    const intervalId = window.setInterval(() => {
      setIndex((prev) => getRandomPlaceholderIndex(texts.length, prev))
    }, PHASE_PLACEHOLDER_ROTATE_MS)

    return () => window.clearInterval(intervalId)
  }, [texts])

  return <p className={className}>{texts[index] ?? ""}</p>
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
        <RotatingPhasePlaceholder
          className="phase-message-phase__rotating-text"
          texts={DAY_PHASE_PLACEHOLDER_TEXTS}
        />
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
        <RotatingPhasePlaceholder
          className="phase-message-phase__rotating-text"
          texts={DISCUSSION_PHASE_PLACEHOLDER_TEXTS}
        />
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
        <RotatingPhasePlaceholder
          className="phase-message-phase__rotating-text"
          texts={DISCUSSION_PHASE_PLACEHOLDER_TEXTS}
        />
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
  const [showNightGuessToast, setShowNightGuessToast] = React.useState(false)
  const isNightGuessPanelRole = myRole === "CIVILIAN" || myRole === "SHERIFF"
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
          .map((p) => {
            const hasRolemateIcon = rolemateSet.has(p.clientId) && rolemateIconSrc != null

            return {
              clientId: p.clientId,
              name: p.name,
              ...(hasRolemateIcon
                ? {
                    iconSrc: rolemateIconSrc,
                    iconAlt: myRole === "MAFIA" ? "Mafia rolemate" : "Doctor rolemate",
                  }
                : {}),
            }
          })
      : []
  const nightGuessTargets =
    canActAtNight && isNightGuessPanelRole
      ? state.players
          .filter(
            (p) =>
              p.alive &&
              p.isSpectator !== true &&
              p.clientId !== me?.clientId
          )
          .map((p) => ({
            clientId: p.clientId,
            name: p.name,
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

  React.useEffect(() => {
    if (!showNightGuessToast) return

    const timeoutId = window.setTimeout(() => {
      setShowNightGuessToast(false)
    }, 1200)

    return () => window.clearTimeout(timeoutId)
  }, [showNightGuessToast])

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

          {canActAtNight && isNightGuessPanelRole && (
            <div className="phase-night__panel-wrap">
              <VotePanel
                className="vote-panel--night"
                title="Who do you think it is?"
                description="Choose the player who feels the most suspicious tonight."
                targets={nightGuessTargets}
                actionLabel="Guess"
                emptyLabel="No valid players are available to choose from."
                skipLabel="Not Sure"
                onSelect={() => {
                  setShowNightGuessToast(true)
                }}
                onSkip={() => {
                  // Intentional no-op: this panel is only for private guessing.
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

        {showNightGuessToast && (
          <div className="phase-night__guess-toast" role="status" aria-live="polite">
            Good Choice
          </div>
        )}
      </div>
    </section>
  )
}

const GameOverScreen = ({
  isHost,
  banner,
  winner,
  actionFeedback,
  leaveRoom,
  backToLobby,
  startNewGame,
}: ScreenProps) => (
  <section className="phase-gameover">
    <div className="phase-gameover__main">
      <div className="phase-gameover__alerts">
        <BannerView banner={banner} />
        <ActionFeedbackView actionFeedback={actionFeedback} />
      </div>

      <section className="phase-gameover__card">
        <div className="phase-gameover__card-title">WINNER</div>
        <div className="phase-gameover__winner">{getWinnerLabel(winner)}</div>

        <div className="phase-gameover__actions">
          <button
            type="button"
            className="phase-gameover__button phase-gameover__button--secondary"
            onClick={leaveRoom}
          >
            Leave Room
          </button>
          <button
            type="button"
            className="phase-gameover__button phase-gameover__button--secondary"
            onClick={backToLobby}
          >
            Back to Lobby
          </button>
          <button
            type="button"
            className={`phase-gameover__button phase-gameover__button--primary ${isHost ? "" : "is-disabled"}`}
            onClick={startNewGame}
            disabled={!isHost}
            title={isHost ? "Start a fresh game immediately." : "Only the host can start a new game."}
          >
            Start New Game
          </button>
        </div>
      </section>
    </div>
  </section>
)


