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

---

- New task: make project UI-friendly for styling/UI implementation handoff.
- Added centralized client UI metadata/helpers in `Client/src/uiMeta.ts`:
  - Phase labels (`PHASE_UI_META`, `getPhaseLabel`)
  - Role labels (`ROLE_UI_META`, `getRoleLabel`)
  - Player status labels (`PLAYER_STATUS_UI_META`, `getStatusLabel`)
  - Winner labels (`getWinnerLabel`)
  - Action labels (`getActionLabel`, `getActionRecordedLabel`)
  - Night-role action mapping (`getNightActionMetaForRole`)
  - Player display helpers (`getPlayerTags`, `getPlayerLifeStateLabel`)
- Wired UI helpers into existing screens:
  - `Client/pages/Lobby.tsx`: standardized player tags + status labels.
  - `Client/pages/Game.tsx`: standardized phase label, player tags/life state, and action feedback labels.
  - `Client/components/PhaseRouter.tsx`: standardized phase headers, role labels, banner phase labels, winner label, and night-action metadata lookup.
  - `Client/src/constants/phaseLabels.ts`: now sourced from centralized UI metadata.
- Note:
  - Initially placed helpers in `Shared/ui.ts`, then moved to `Client/src/uiMeta.ts` to avoid `TS1287` (CommonJS/ESM boundary issue under current package setup).
- Validation:
  - `Client`: `npx tsc -p tsconfig.json --noEmit` passes.
  - `Client`: `npm run build` passes.
  - `Server`: `npx tsc -p tsconfig.json --noEmit` passes.
  - `Server`: `npm run build` passes.
  - Playwright skill script executed:
    - `node C:/Users/User/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --click 100,100 --click-selector button --iterations 1 --pause-ms 250`
    - Screenshot reviewed: `output/web-game/shot-0.png` (Join screen visible, no obvious runtime regressions from this UI-helper refactor).

---

- New task: after each NIGHT phase, broadcast a global announcement naming who mafia killed.
- Updated shared summary payload for UI consumption:
  - `Shared/events.ts`: `RoundSummaryPayload` now includes optional `killedClientId` and `killedPlayerName`.
  - `Shared/events.ts`: `PublicAnnouncementPayload` `NIGHT_SUMMARY` now also supports optional `killedPlayerName`.
- Server wiring:
  - `Server/rooms.ts` `applyNightResolution` now resolves and emits `nightSummary` with:
    - `someoneDied`
    - `killedClientId` (when a kill happened)
    - `killedPlayerName` (when available)
  - This is emitted to the full room (`io.to(room).emit`), so announcement is global.
- Client/UI-friendly wiring:
  - `Client/src/uiMeta.ts`: added `getNightSummaryLabel(payload)` to centralize copy generation.
  - `Client/pages/Game.tsx`: night banner now uses `getNightSummaryLabel`, so UI can display `Night ended: {player} was killed.`
  - Added inline note for UI dev to use `payload.killedPlayerName` directly for richer announcement cards/toasts.
- Validation:
  - `Server`: `npm run build` passes.
  - `Client`: `npm run build` passes.
  - `Server`: `npx tsc -p tsconfig.json --noEmit` passes.
  - `Client`: `npx tsc -p tsconfig.json --noEmit` passes.

---

- New task: apply the 3 TODO items from this file.
- Implemented TODO #1 (host spectator badge):
  - `Client/src/uiMeta.ts` `getPlayerTags` now emits a dedicated `HOST DEVICE` badge when the host is spectating.
  - Existing lobby/game tag rendering picks this up automatically via shared UI metadata.
- Implemented TODO #2 (opt-out confirmation):
  - `Client/pages/Lobby.tsx` now asks for confirmation before turning host participation OFF.
  - Confirmation copy explains that host becomes spectator and will not receive a role until opting back in.
- Implemented TODO #3 (shared host-participation typings tightening):
  - `Shared/events.ts` now exports explicit host-participation handler types:
    - `SetHostParticipationEvent`
    - `HostParticipationRefusedEvent`
  - `Server/index.ts` now wires `setHostParticipation` using the shared handler type.
  - `Server/rooms.ts` `setHostParticipationLocal` now accepts `SetHostParticipationPayload` directly (shared payload object path end-to-end).
  - `Client/pages/Lobby.tsx` now uses shared host-participation handler function types for emit/listener wiring.
- Validation:
  - `Server`: `npm run build` passes.
  - `Server`: `npx tsc -p tsconfig.json --noEmit` passes.
  - `Client`: `npm run build` passes.
  - `Client`: `npx tsc -p tsconfig.json --noEmit` passes.
  - Playwright skill smoke script executed against local preview:
    - `node C:/Users/User/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --click 100,100 --click-selector button --iterations 1 --pause-ms 250`
    - Latest artifact updated: `output/web-game/shot-0.png`.

---

- New task: align project version metadata with latest patch line.
- Updated version from `0.7.5` -> `0.8.4` in:
  - Root `package.json` + `package-lock.json`
  - `Mafia-Local/Client/package.json` + `package-lock.json`
  - `Mafia-Local/Server/package.json` + `package-lock.json`
  - `Mafia-Local/Electron/package.json` + `package-lock.json`
- Updated docs release example:
  - `Mafia-Local/README.md`: `v0.7.5` -> `v0.8.4`.
- Packaging/build validation:
  - Ran `npm run dist` in `Mafia-Local/Electron`.
  - Generated installer artifacts include:
    - `Mafia-Local/Electron/dist/Mafia Local Setup 0.8.4.exe`
    - `Mafia-Local/Electron/dist/Mafia Local Setup 0.8.4.exe.blockmap`
