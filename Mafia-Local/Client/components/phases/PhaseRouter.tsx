import React from "react"
import type { RoomState, Player } from "../../src/types.js"

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
}

const BannerView = ({ banner }: { banner: Banner }) => {
  if (!banner) return null
  return (
    <div style={{ marginBottom: 10, padding: 10, border: "1px solid #ddd" }}>
      <strong>{banner.kind === "NIGHT" ? "Night" : "Voting"}:</strong> {banner.text}
    </div>
  )
}

const LobbyScreen = ({ isHost, isSpectator, myRole, banner }: ScreenProps) => (
  <div>
    <h2>Lobby</h2>
    <BannerView banner={banner} />
    <div>Waiting for host to start…</div>
    <div style={{ marginTop: 8 }}>
      <div>Host: {isHost ? "Yes" : "No"}</div>
      <div>Spectator: {isSpectator ? "Yes" : "No"}</div>
      <div>My role: {myRole ?? "(unknown yet)"} </div>
    </div>
  </div>
)

const DayScreen = ({ isSpectator, myRole, banner }: ScreenProps) => (
  <div>
    <h2>Day</h2>
    <BannerView banner={banner} />
    <div>Daytime phase content goes here.</div>
    <div style={{ marginTop: 8 }}>
      <div>Spectator: {isSpectator ? "Yes" : "No"}</div>
      <div>My role: {myRole ?? "(unknown)"} </div>
    </div>
  </div>
)

const DiscussionScreen = ({ banner }: ScreenProps) => (
  <div>
    <h2>Discussion</h2>
    <BannerView banner={banner} />
    <div>Discussion phase content goes here.</div>
  </div>
)

const PubDiscussionScreen = ({ banner }: ScreenProps) => (
  <div>
    <h2>Public Discussion</h2>
    <BannerView banner={banner} />
    <div>Public discussion content goes here.</div>
  </div>
)

const VotingScreen = ({ isSpectator, myActions, banner }: ScreenProps) => (
  <div>
    <h2>Voting</h2>
    <BannerView banner={banner} />
    <div>Voting UI goes here.</div>

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

const NightScreen = ({ isSpectator, myRole, myActions, privateMessages, banner }: ScreenProps) => (
  <div>
    <h2>Night</h2>
    <BannerView banner={banner} />
    <div>Night role action UI goes here.</div>

    <div style={{ marginTop: 10 }}>
      <div>
        <strong>My role:</strong> {myRole ?? "(unknown)"}
      </div>

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

const GameOverScreen = ({ isHost, banner }: ScreenProps) => (
  <div>
    <h2>Game Over</h2>
    <BannerView banner={banner} />
    <div>Winner + restart options go here.</div>
    <div style={{ marginTop: 8 }}>Host: {isHost ? "Yes" : "No"}</div>
  </div>
)
