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
- Updated version from `0.7.5` -> `0.9.3` in:
  - Root `package.json` + `package-lock.json`
  - `Mafia-Local/Client/package.json` + `package-lock.json`
  - `Mafia-Local/Server/package.json` + `package-lock.json`
  - `Mafia-Local/Electron/package.json` + `package-lock.json`
- Updated docs release example:
  - `Mafia-Local/README.md`: `v0.7.5` -> `v0.9.3`.
- Packaging/build validation:
  - Ran `npm run dist` in `Mafia-Local/Electron`.
  - Generated installer artifacts include:
    - `Mafia-Local/Electron/dist/Mafia Local Setup 0.9.3.exe`
    - `Mafia-Local/Electron/dist/Mafia Local Setup 0.9.3.exe.blockmap`

---

- New task: implement desktop shortcut behavior for installer.
- Updated `Mafia-Local/Electron/electron-builder.json` NSIS config:
  - `createDesktopShortcut: "always"`
  - `createStartMenuShortcut: true`
  - `shortcutName: "Mafia Local"`
- Packaging/build validation:
  - Ran `npm run dist` in `Mafia-Local/Electron` after config change.
  - Refreshed installer artifacts:
    - `Mafia-Local/Electron/dist/Mafia Local Setup 0.9.3.exe`
    - `Mafia-Local/Electron/dist/Mafia Local Setup 0.9.3.exe.blockmap`

---

- New task: set desktop/app icon to project Mafia icon instead of default Electron icon.
- Updated icon wiring:
  - `Mafia-Local/Electron/electron-builder.json`:
    - `win.icon: "assets/Mafia-Icon.ico"`
    - `nsis.installerIcon: "assets/Mafia-Icon.ico"`
    - `nsis.uninstallerIcon: "assets/Mafia-Icon.ico"`
    - `nsis.installerHeaderIcon: "assets/Mafia-Icon.ico"`
  - `Mafia-Local/Electron/main.js`:
    - BrowserWindow icon now prefers `assets/Mafia-Icon.ico` with PNG fallback.
- Packaging/build validation:
  - Ran `npm run dist` in `Mafia-Local/Electron`.
  - Installer rebuilt successfully:
    - `Mafia-Local/Electron/dist/Mafia Local Setup 0.9.3.exe`
    - `Mafia-Local/Electron/dist/Mafia Local Setup 0.9.3.exe.blockmap`

---

- New task: desktop shortcut still showed default Electron icon.
- Root cause findings:
  - Installed shortcut target pointed to `...\Programs\electron\Mafia Local.exe`.
  - EXE icon remained Electron icon in this environment when relying on executable icon embedding.
  - Direct `signAndEditExecutable: true` path hit local winCodeSign extraction symlink privilege errors.
- Implemented robust shortcut-icon override in NSIS:
  - Added `Mafia-Local/Electron/installer.nsh` with `customInstall` macro that recreates desktop/start-menu links using:
    - target: `$INSTDIR\Mafia Local.exe`
    - icon: `$INSTDIR\resources\Mafia-Icon.ico`
  - Updated `Mafia-Local/Electron/electron-builder.json`:
    - added `extraResources` entry to copy `assets/Mafia-Icon.ico` to packaged `resources/Mafia-Icon.ico`
    - added `nsis.include: "installer.nsh"`
    - kept shortcut creation enabled (`createDesktopShortcut`, `createStartMenuShortcut`)
  - Refreshed `Mafia-Local/Electron/assets/Mafia-Icon.ico` with a compatible generated icon asset.
- Packaging/build validation:
  - Ran `npm run dist` in `Mafia-Local/Electron` after NSIS include/icon changes.
  - Installer rebuilt successfully:
    - `Mafia-Local/Electron/dist/Mafia Local Setup 0.9.3.exe`
    - `Mafia-Local/Electron/dist/Mafia Local Setup 0.9.3.exe.blockmap`
  - Silent install check confirmed desktop shortcut now carries explicit custom icon location:
    - `C:\Users\User\AppData\Local\Programs\electron\resources\Mafia-Icon.ico,0`

---

- New task: use user-provided `Mafia-Icon-256x256.ico` for desktop icon behavior.
- Updated `Mafia-Local/Electron/electron-builder.json` icon sources to:
  - `win.icon: assets/Mafia-Icon-256x256.ico`
  - `nsis.installerIcon: assets/Mafia-Icon-256x256.ico`
  - `nsis.uninstallerIcon: assets/Mafia-Icon-256x256.ico`
  - `nsis.installerHeaderIcon: assets/Mafia-Icon-256x256.ico`
  - `extraResources` now copies `assets/Mafia-Icon-256x256.ico` to packaged `resources/Mafia-Icon.ico`.
- Packaging/build validation:
  - Ran `npm run dist` in `Mafia-Local/Electron`.
  - Silent install check still confirms desktop shortcut icon path:
    - `C:\Users\User\AppData\Local\Programs\electron\resources\Mafia-Icon.ico,0`

---

- New task: prepare (but do not implement) splash screen/custom titlebar structure and client-side style scaffolding.
- Added Electron UI scaffolding files (not wired yet):
  - `Mafia-Local/Electron/ui/splash.html`
  - `Mafia-Local/Electron/ui/splash.css`
  - `Mafia-Local/Electron/ui/titlebar.css`
  - `Mafia-Local/Electron/ui/titlebar.contract.md`
  - `Mafia-Local/Electron/ui/README.md`
- Added Client style scaffolding:
  - Universal stylesheet: `Mafia-Local/Client/src/styles/global.css`
  - Style notes: `Mafia-Local/Client/src/styles/README.md`
  - Page buckets:
    - `Mafia-Local/Client/src/styles/pages/join.css`
    - `Mafia-Local/Client/src/styles/pages/lobby.css`
    - `Mafia-Local/Client/src/styles/pages/game.css`
  - Phase buckets:
    - `Mafia-Local/Client/src/styles/phases/lobby.css`
    - `Mafia-Local/Client/src/styles/phases/day.css`
    - `Mafia-Local/Client/src/styles/phases/discussion.css`
    - `Mafia-Local/Client/src/styles/phases/public-discussion.css`
    - `Mafia-Local/Client/src/styles/phases/voting.css`
    - `Mafia-Local/Client/src/styles/phases/night.css`
    - `Mafia-Local/Client/src/styles/phases/gameover.css`
- Build/package validation:
  - Ran `npm run dist` in `Mafia-Local/Electron` after scaffolding changes.

---

- New task: add first-launch main menu split between Play Game and Role Assigner, with back navigation between both entry flows.
- Full project scan performed before implementation (Client routing/pages, shared events, server room typing, Electron packaging setup).
- Added `Client/pages/MainMenu.tsx`:
  - First-launch screen with two options:
    - `Play Game`
    - `Role Assigner`
- Updated `Client/src/App.tsx`:
  - Added app screen state `MENU` and entry mode tracking (`PLAY_GAME` / `ROLE_ASSIGNER`).
  - New flow:
    - `MENU -> JOIN(mode) -> LOBBY -> GAME`
  - Exit now returns to `MENU` so users can switch between paths.
- Updated `Client/pages/Join.tsx`:
  - Added `mode` + `onBackToMenu` props.
  - Mode-specific behavior:
    - `PLAY_GAME`: `Create Room` + `Join Room`
    - `ROLE_ASSIGNER`: `Create Role Assigner Room` (role selector room type) + `Join Room`
  - Added `Back to Menu` button on join screen.
- Validation:
  - Ran `npm --prefix Mafia-Local/Electron run dist` successfully.
  - Client build, server TypeScript build, and installer packaging all passed.

TODO / next-agent suggestions:
- If desired, add a `Back to Menu` affordance directly inside Lobby/Game (currently users can leave room, then return to menu via app flow).
- If desired, split join copy/placeholders slightly further between modes (e.g., join button text for role assigner mode).

---

- New task: fix Role Assigner linking so it consistently creates/joins role-assignment rooms.
- Root issue addressed:
  - Join flow did not enforce room-mode compatibility.
  - Role Assigner and Play Game could join each other's room types with no guard.
- Implemented room-type-safe linking:
  - `Shared/events.ts`:
    - `JoinRoomPayload` now includes optional `expectedRoomType`.
  - `Client/pages/Join.tsx`:
    - Create action now always sends explicit room type by mode:
      - `PLAY_GAME` -> `CLASSIC`
      - `ROLE_ASSIGNER` -> `ROLE_SELECTOR`
    - Join action now sends `expectedRoomType` based on selected entry mode.
  - `Server/index.ts`:
    - Passes `expectedRoomType` from socket `joinRoom` payload into room manager.
  - `Server/rooms.ts`:
    - `joinRoomLocal` now validates expected mode against actual room type and rejects mismatches with `roomInvalid` reason.
- Validation:
  - `Client`: `npm run build` passes.
  - `Server`: `npm run build` passes.
  - Playwright skill script run and screenshot reviewed:
    - `output/web-game/shot-0.png` shows Role Assigner join screen after menu navigation.
---

- New task: installed app showed `Cannot GET /` on launch.
- Root cause addressed:
  - In packaged mode, backend sometimes launched without a resolved client dist directory, so Express had no route/static handler for `/`.
- Implemented packaged routing hardening:
  - `Electron/main.js`:
    - Added packaged client dist resolver (`getPackagedClientDistPath`).
    - When packaged, now sets `process.env.MAFIA_CLIENT_DIST_DIR` before importing server entry.
  - `Server/index.ts`:
    - Added `CLIENT_INDEX_PATH` derivation.
    - Added explicit fallback routes for `/` and non-API deep links to serve client `index.html` when available.
- Validation:
  - `Client`: `npm run build` passes.
  - `Server`: `npm run build` passes.
  - `Electron`: `npm run dist` passes; installer artifacts refreshed for `0.9.3`.
---

- New task: `Cannot GET /` persisted after install.
- Root cause found:
  - Packaged app had stale `Server/dist/index.js` plus current `Server/dist/Server/index.js`.
  - Electron startup path preferred stale `Server/dist/index.js`, so latest server routing fixes were bypassed.
- Implemented fix:
  - `Electron/main.js`: `getServerEntryPath` now prioritizes `Server/dist/Server/index.js` across packaged path candidates.
  - `Server/package.json`: build now clears `dist` before TypeScript compile, preventing stale duplicate entry files.
- Validation:
  - `npm run build` in `Mafia-Local/Server` passes.
  - `Server/dist` now only contains `Server/` and `Shared/` (no stale top-level `index.js`).
  - `npm run dist` in `Mafia-Local/Electron` passes.
  - Asar check confirms `\Server\dist\Server\index.js` exists and stale `\Server\dist\index.js` is absent.
  - Runtime smoke (`node` import of `Server/dist/Server/index.js` with `MAFIA_CLIENT_DIST_DIR`) returns HTTP 200 for `/`.

---

- New task: replace shield-like UI icon usage with the current Mafia icon asset.
- Updated icon assets (without changing existing code references):
  - Replaced `Client/public/assets/Mafia-Icon.png` with a 256x256 transparent icon render derived from `Electron/assets/Mafia-Icon.ico`.
  - Replaced `Electron/assets/Mafia-Icon.png` with the same icon render for consistency in fallback/runtime contexts.
- Visual validation:
  - Playwright screenshot re-run confirms Join page brand/button now show the Mafia icon instead of shield-like placeholders.
- Packaging/build validation:
  - Ran `npm run dist` in `Mafia-Local/Electron` successfully.
  - Refreshed installer artifact: `Mafia-Local/Electron/dist/Mafia Local Setup 0.9.5.exe`.

---

- New task: restyle Main Menu to match Join page visual direction.
- Updated `Client/pages/MainMenu.tsx`:
  - Removed inline light-theme styles.
  - Switched to class-based structure and imported new page CSS.
  - Added Join-like layout sections: top brand row, centered hero, dark menu card, gradient + secondary action buttons, and footer.
- Added `Client/src/styles/pages/main-menu.css`:
  - Full-bleed dark gradient background and safe-area padding.
  - Centered card with Join-consistent border, typography scale, and button treatments.
  - Responsive mobile behavior aligned with Join page breakpoints.
- Validation:
  - `Client`: `npm run build` passes.
  - Playwright screenshot reviewed: `output/web-game/shot-0.png` (Main Menu now visually aligned with Join style).
  - `Electron`: `npm run dist` passes; installer refreshed (`Mafia Local Setup 0.9.5.exe`).

---

- New task: verify MainMenu error before further UI changes, then make both Main Menu buttons dark purple.
- Root cause identified for reported MainMenu error:
  - TypeScript (`npx tsc --noEmit`) failed on CSS side-effect imports (`TS2307`) due missing CSS module declarations in Client.
- Fix implemented:
  - Added `Client/src/vite-env.d.ts` with:
    - `/// <reference types="vite/client" />`
    - `declare module "*.css"`
  - This resolves TypeScript CSS import errors for `MainMenu.tsx`, `Join.tsx`, and `src/main.tsx`.
- Requested UI change implemented:
  - Updated `Client/src/styles/pages/main-menu.css` so both menu buttons use the same dark purple style (removed bright pink gradient).
- Validation:
  - `Client`: `npx tsc -p tsconfig.json --noEmit` passes.
  - `Client`: `npm run build` passes.
  - Playwright screenshot reviewed (`output/web-game/shot-0.png`) confirms both Main Menu buttons are dark purple.
  - `Electron`: `npm run dist` passes; installer refreshed (`Mafia Local Setup 0.9.5.exe`).

---

- New task: redesign Lobby screens to match provided desktop/mobile references and start-button ready state.
- Updated `Client/pages/Lobby.tsx`:
  - Replaced inline-style layout with structured desktop/mobile lobby shell:
    - Left sidebar (brand, local player profile, settings/ready/leave actions)
    - Main content area (lobby title/code/share, player count, start controls, info panels, player card grid)
  - Preserved existing lobby logic/events:
    - start/force start, ready toggle, leave room, host participation toggle, kick player
    - role-selector behaviors (deal/redeal/request role, host counts, script status)
    - host settings + role selector settings modals + role catalog/info modals
  - Added room-code copy/share actions with clipboard/share API fallback.
  - Added dynamic Start button states for classic rooms:
    - disabled style when not all ready
    - gradient enabled style when all ready
- Updated `Client/src/styles/pages/lobby.css`:
  - Implemented full dark lobby theme based on provided references.
  - Added responsive behavior for desktop and mobile layouts.
  - Added player cards, status pills, action buttons, and start-state styles.
- Updated shell wrapper for lobby full-bleed rendering:
  - `Client/src/App.tsx`: lobby now uses `ui-app-shell ui-app-shell--lobby`
  - `Client/src/styles/global.css`: added `.ui-app-shell--lobby`.
- Validation:
  - `Client`: `npx tsc -p tsconfig.json --noEmit` passes.
  - `Client`: `npm run build` passes.
  - Playwright captures (new):
    - `output/web-game/lobby-desktop-disabled.png`
    - `output/web-game/lobby-desktop-ready.png`
    - `output/web-game/lobby-mobile.png`
  - `Electron`: `npm run dist` passes; installer refreshed (`Mafia Local Setup 0.9.5.exe`).

---

- New task: fix status/kick overlap in lobby player cards and restyle settings menus to match project dark UI theme.
- Fixed kick/status overlap:
  - `Client/src/styles/pages/lobby.css`: changed `.lobby-kick-button` from absolute positioning to normal flow (`position: static`, own spacing).
  - Result: kick `x` no longer overlaps Ready/Not Ready status pill.
- Settings menu visual refresh (project-consistent dark style):
  - Added shared settings modal stylesheet:
    - `Client/src/styles/components/settings-modal.css`
  - Updated `Client/components/HostSettings.tsx`:
    - migrated from inline white modal styling to shared dark modal classes.
    - fixed close button text rendering to plain `X`.
  - Updated `Client/components/RoleSelectorSettings.tsx`:
    - migrated from inline white modal styling to shared dark modal classes.
- Validation:
  - `Client`: `npx tsc -p tsconfig.json --noEmit` passes.
  - `Client`: `npm run build` passes.
  - Visual screenshots captured:
    - `output/web-game/lobby-kick-spacing.png` (status + kick spacing verified)
    - `output/web-game/lobby-settings-modal.png` (settings dark theme verified)
  - `Electron`: `npm run dist` passes; installer refreshed (`Mafia Local Setup 0.9.5.exe`).

---

- New task: restyle Role Assigner "Available Roles" modal to match project dark theme and improve readability.
- Added `Client/src/styles/components/role-catalog-modal.css`:
  - Dark themed overlay/panels, readable typography, grouped list spacing, accessible contrast.
  - Includes styles for both Role Catalog modal and Role Info modal.
- Updated `Client/components/RoleCatalogModal.tsx`:
  - Removed inline white styles.
  - Switched to class-based dark modal layout and role list/button styling.
- Updated `Client/components/RoleInfoModal.tsx`:
  - Removed inline white styles.
  - Switched to class-based dark modal layout to match Role Catalog and overall app theme.
- Validation:
  - `Client`: `npx tsc -p tsconfig.json --noEmit` passes.
  - `Client`: `npm run build` passes.
  - Visual check screenshot: `output/web-game/role-catalog-dark.png`.
  - `Electron`: `npm run dist` passes; installer refreshed (`Mafia Local Setup 0.9.5.exe`).

---

- New task: re-check BOCT import regression after merge/runtime confusion.
- Investigation findings:
  - Server BOCT import handlers are wired and functional (`updateRoleSelectorSettings` + `importBotcScript`).
  - End-to-end socket integration check confirms successful flow:
    - create ROLE_SELECTOR room
    - switch scriptMode to `BLOOD_ON_THE_CLOCKTOWER`
    - import JSON
    - receive `botcScriptImported`
- UX fix implemented for import gating:
  - `Client/components/RoleSelectorSettings.tsx`
    - Import validation now uses the currently selected modal mode (`scriptMode`) instead of only persisted room mode.
    - This prevents false client-side blocking when host selected BOCT but room-state sync is slightly behind.
    - Import hint text updated to explain retry path (`save settings and retry`) if server refuses.
- Validation:
  - `npm --prefix Mafia-Local/Client run build` passes.
  - `npm --prefix Mafia-Local/Server run build` passes.
  - `npm --prefix Mafia-Local/Electron run build` passes.
  - Socket integration check passes: `botcScriptImported` emitted with script summary.
