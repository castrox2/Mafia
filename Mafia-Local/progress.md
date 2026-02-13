Original prompt: Could you add a feature that allows the Host to opt out of the game? so that the host device can be used ONLY as a host device and not as a player? and if they opt out they can be treated as a spectator essentially (they can see what phase it is, who's dead or alive, etc.)

- Located target repo at C:\Users\User\Documents\GitHub\Mafia\Mafia-Local.
- Current behavior: host is always reset to active player on game start (`resetPlayersForNewGame`).
- Current behavior: start readiness checks include all players.
- Current behavior: spectators already cannot act, and can observe phase info.
- Next: add host opt-out toggle server+client and preserve as spectator when opted out.
- Implemented server room flag `hostParticipates` with `roomState` broadcast support.
- Added host-only `setHostParticipationLocal` mutation (lobby-only, rejects during active game).
- Updated start flow: readiness and role normalization now use active (non-spectator) player count.
- Updated reset-for-new-game: host remains spectator when opted out.
- Added server socket event `setHostParticipation` in `Server/index.ts`.
- Updated lobby UI with host participation checkbox + spectator-aware ready control.
- Added in-game player status panel showing alive/dead/spectator/host for spectator host visibility.
- Validation:
  - `Server`: npm run build (tsc) passes.
  - `Client`: npm run build (vite) passes.
  - Automated socket-flow smoke test: created room, host toggled `participates=false`, started game with active players, confirmed host remained spectator and did not receive `yourRole` while active players did.
- Playwright skill script was executed; screenshot captured Join screen. Full multi-step lobby interaction is limited by that script's input model for this app (non-canvas UI), so role-flow verification was done via socket integration script instead.

TODO / next-agent suggestions:
- Add a dedicated UI badge in Lobby player list for "HOST DEVICE" when host is spectating.
- Optionally add a confirmation dialog before host toggles participation off to avoid accidental opt-out.
- If desired, add shared event typings for `setHostParticipation` / `hostParticipationRefused` in `Shared/events.ts` to tighten compile-time contract across client/server.

---

- New task: centralized all client/server Socket.IO event contracts in `Shared/events.ts`.
- Added full shared event maps:
  - `MafiaClientToServerEvents`
  - `MafiaServerToClientEvents`
  - Shared payload/domain types (`RoomStatePayload`, `MyActionsPayload`, timer payloads, role/action payloads, etc.).
- Kept backward-compatible aliases for host-participation-only usage:
  - `HostParticipationClientToServerEvents`
  - `HostParticipationServerToClientEvents`
- Updated wiring:
  - `Client/src/socket.ts` now uses strict shared socket interfaces (removed `AnyEventMap` fallback).
  - `Client/src/types.ts` now aliases shared payload/domain types to avoid drift.
  - `Client/pages/Game.tsx` now uses shared `MyActionsPayload`.
  - `Server/index.ts` now binds socket handlers with payloads from `Shared/events.ts`.
  - `Server/rooms.ts` now uses typed server socket/io generics from shared event maps.
  - `Server/utils/timers.ts` now uses typed server io generics + shared phase type.
- Build/tooling change required for server:
  - `Server/package.json` build script now compiles with `--rootDir ..` so `Shared/events.ts` can be included.
  - `Server/package.json` start script updated to `node dist/Server/index.js`.
- Validation:
  - `Client`: `npm run build` passes.
  - `Client`: `npx tsc -p tsconfig.json --noEmit` passes.
  - `Server`: `npm run build` passes.
  - `Server`: `npx tsc -p tsconfig.json --noEmit` passes.

