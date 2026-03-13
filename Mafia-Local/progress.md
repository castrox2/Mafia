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

---

- New task: wire splash screen so it shows first while app/renderer loads.
- Implemented Electron splash startup flow in `Electron/main.js`:
  - Added dedicated splash window (`ui/splash.html`) that opens immediately on app start.
  - Main window now starts hidden (`show: false`) and loads renderer in background.
  - Main window is shown only after `ready-to-show`, then splash closes.
  - Added minimum splash visibility window (`SPLASH_MIN_VISIBLE_MS = 900`) to prevent flash/flicker.
  - Added fallback to close splash and show main window even if `ready-to-show` does not fire.
- Build/package validation:
  - `npm --prefix Mafia-Local/Electron run build` passes.
  - Default `npm --prefix Mafia-Local/Electron run dist` failed due OS file lock on old `dist/win-unpacked/resources/app.asar`.
  - Successful packaged installer generated via alternate output directory:
    - `Mafia-Local/Electron/dist2/Mafia Local Setup 0.9.5.exe`
    - `Mafia-Local/Electron/dist2/Mafia Local Setup 0.9.5.exe.blockmap`

---

- New task: packaged installer did not show splash screen.
- Root cause found:
  - `Electron/electron-builder.json` `files` whitelist did not include `ui/**/*`, so `ui/splash.html` and `ui/splash.css` were missing from packaged `app.asar`.
- Fix implemented:
  - Added `ui/**/*` to `Electron/electron-builder.json` `files` array.
- Validation:
  - `npm --prefix Mafia-Local/Electron run dist` still hit existing file lock on `dist/win-unpacked/resources/app.asar`.
  - Built successfully to new output folder: `dist3`.
  - Confirmed packaged asar now includes splash files:
    - `\ui\splash.html`
    - `\ui\splash.css`
  - Copied new installer artifacts into standard release path:
    - `Mafia-Local/Electron/dist/Mafia Local Setup 0.9.5.exe`
    - `Mafia-Local/Electron/dist/Mafia Local Setup 0.9.5.exe.blockmap`
- Additional ignore cleanup:
  - `.gitignore` now includes `Mafia-Local/Electron/dist*/` to avoid future generated output clutter.

---

- Follow-up: persistent lock on `Electron/dist/win-unpacked/resources/app.asar` blocked direct `npm run dist` output into `dist`.
- Workaround used (without creating new project dist folders):
  - Built installer to temp output outside repo:
    - `C:\Users\User\AppData\Local\Temp\mafia-electron-dist-temp`
  - Verified packaged splash files are present in asar (`\ui\splash.html`, `\ui\splash.css`).
  - Replaced setup artifacts in standard release folder:
    - `Mafia-Local/Electron/dist/Mafia Local Setup 0.9.5.exe`
    - `Mafia-Local/Electron/dist/Mafia Local Setup 0.9.5.exe.blockmap`
  - Deleted temp output folder after copy.

---

- New task: make splash use full-screen artwork background and keep title/subtitle/loader.
- Implemented splash redesign:
  - `Electron/ui/splash.html`:
    - Removed inline logo element; splash now uses full background image layout.
    - Kept title/subtitle/loading bar.
  - `Electron/ui/splash.css`:
    - Full background image (`Mafia Splash Screen.png`) with `background-size: cover`.
    - Added dark overlay layers for readability.
    - Positioned loader near center/finger-point area (`top: 56%`) without image distortion.
    - Title/subtitle remain visible near lower center.
  - `Electron/main.js`:
    - Splash window resized to fixed 16:9 (`960x540`).
- Validation:
  - `npm --prefix Mafia-Local/Electron run build` passes.
- Preview screenshot generated to root output folder:
  - `output/splash-fullbg-preview.png`

---

- New task: start extracting voting UI into a reusable panel component.
- Added reusable `Client/components/VotePanel.tsx` with a dedicated stylesheet:
  - `Client/src/styles/components/vote-panel.css`
- Voting phase in `Client/components/PhaseRouter.tsx` now uses `VotePanel` instead of inline button/list markup.
- Goal: use this same panel pattern later for other target-selection phases/actions to reduce duplicated UI logic.

---

- Follow-up task: make the voting list scroll internally when too many players are present and remove leftover preview HTML after screenshot export.
- Updated `Client/components/PhaseRouter.tsx`:
  - Voting phase now uses a dedicated full-height wrapper around `VotePanel`.
- Updated `Client/src/styles/components/vote-panel.css`:
  - Voting screen wrapper now reserves bounded height inside the locked game shell.
  - `VotePanel` now supports internal overflow and mobile touch scrolling for long player lists.
- Cleaned up preview artifacts:
  - Deleted `output/web-game/vote-panel-preview.html`
  - Kept only the exported image files in `output/web-game`

---

- Follow-up task: remove duplicated centered phase text only where the phase screen already shows its own inline title.
- Scan result:
  - Duplicate title phases were `LOBBY`, `VOTING`, `NIGHT`, and `GAMEOVER`.
- Updated `Client/pages/Game.tsx`:
  - The centered topbar phase label is now hidden only for phases that already render an internal title.
- Updated `Client/src/styles/pages/game.css`:
  - Added a small spacer class so the topbar grid remains stable when the center label is suppressed.

---

- Follow-up correction: restored the centered topbar phase label on all phases.
- Updated `Client/pages/Game.tsx`:
  - Removed the temporary phase-title suppression logic.
- Updated `Client/src/styles/pages/game.css`:
  - Removed the temporary topbar spacer class added for the suppression logic.

---

- Follow-up clarification: keep the centered topbar phase label and remove only the duplicated in-content phase title.
- Applied only to `VOTING` and `NIGHT` for now.
- Updated `Client/components/PhaseRouter.tsx`:
  - Removed the inline `Voting` title from the voting phase content.
  - Removed the inline `Night` title from the night phase content.
- Updated `Client/src/styles/components/vote-panel.css`:
  - Removed the now-unused voting title style.

---

- Follow-up task: remove two leftover night-phase placeholder lines and move the host-only testing skip button away from the voting panel's skip button.
- Updated `Client/components/PhaseRouter.tsx`:
  - Removed `Night role action UI goes here.`
  - Removed the inline `My role: ...` line from the night phase.
- Updated `Client/pages/Game.tsx`:
  - The host-only `Skip Phase` testing button now gains a voting-only modifier while the current phase is `VOTING`.
- Updated `Client/src/styles/pages/game.css`:
  - Added a voting-only left-side placement for the floating `Skip Phase` button on desktop and mobile.

---

- Follow-up task: restyle the night phase only visually, keeping the existing gameplay/action flow unchanged.
- Updated `Client/components/PhaseRouter.tsx`:
  - Imported `Client/src/styles/phases/night.css`.
  - Added dedicated night-phase class hooks around the existing action list and buttons.
  - Kept the same night actions and target submission behavior.
- Updated `Client/src/styles/phases/night.css`:
  - Replaced the placeholder file with a full moonlit/cool-toned night theme.
  - Added styling for alerts, action list rows, rolemate icon treatment, action buttons, skip button, and spectator note.
- Validation:
  - Generated a disposable night preview image at `output/web-game/night-phase-preview.png`.
  - Deleted the temporary preview HTML after capture to keep only the image artifact.
  - Ran Playwright smoke client against the app root and inspected the latest screenshot.

---

- Follow-up task: fix night action overflow so long Mafia/Doctor/Detective target lists remain usable on mobile and desktop.
- Current behavior note:
  - The night actions do **not** use the shared `VotePanel`; they still use the custom night panel in `Client/components/PhaseRouter.tsx`.
- Updated `Client/src/styles/phases/night.css`:
  - The night action panel now has a bounded max height.
  - The target list inside the panel now scrolls internally with touch scrolling enabled.
  - The bottom skip button stays visible outside the scrolling list.
- Validation:
  - Generated and inspected a temporary mobile overflow check image with 10 sample targets.
  - Deleted the temporary validation files after inspection.
  - Ran Playwright smoke client against the app root again.

---

- Follow-up task: move Mafia/Doctor/Detective night actions onto the shared `VotePanel` while keeping the cool night styling.
- Updated `Client/components/VotePanel.tsx`:
  - Added optional `className` support for themed variants.
  - Added optional per-target icon support for rolemate markers.
- Updated `Client/components/PhaseRouter.tsx`:
  - Replaced the custom night action list/buttons with the shared `VotePanel`.
  - Preserved existing role action submission behavior and skip behavior.
  - Added role-specific night copy for Mafia/Doctor/Detective panel titles/descriptions.
- Updated `Client/src/styles/components/vote-panel.css`:
  - Added shared icon row/icon styling for reusable target rows.
- Updated `Client/src/styles/phases/night.css`:
  - Replaced the old custom night list/button skin with theme overrides for `.vote-panel--night`.
  - Kept the night panel bounded and internally scrollable.
- Validation:
  - `npm run build` passed.
  - Ran Playwright smoke client against the app root and inspected the output screenshot.

---

- Follow-up task: fix the remaining night shared-panel overflow issue where the Mafia kill panel could still expand instead of scrolling.
- Updated `Client/src/styles/phases/night.css`:
  - Made the night panel wrapper use a direct viewport-based bounded height.
  - Kept the night panel stretched to that fixed slot and clipped within it.
- Updated `Client/src/styles/components/vote-panel.css`:
  - Made the shared `VotePanel` use an explicit `grid-template-rows: auto minmax(0, 1fr) auto` layout.
  - Added `overflow: hidden` on the panel shell so the list area is the scrolling region.
  - Kept the target list as the middle bounded scroll area.
  - Added `touch-action: pan-y` on the shared panel and target rows to improve touch scrolling.
- Validation:
  - Built a disposable mobile height-check page and verified the list is clipped while the skip action stays anchored.
  - Deleted the temporary validation files after inspection.
  - Ran Playwright smoke client against the app root again.

---

- Follow-up task: prevent detectives from investigating more than once in the same NIGHT phase.
- Updated `Server/roles/index.ts`:
  - Added a detective once-per-phase tracker keyed by `(roomId, phase, detectiveClientId)`.
  - Wired the tracker to clear automatically when phase actions are cleared.
- Updated `Server/rooms.ts`:
  - Detective checks are now refused after the first accepted investigation in the current NIGHT.
  - The first accepted non-skip detective check marks the phase-use tracker immediately.
- Validation:
  - `npm run build` to verify client/server compile cleanly after the server-side rule change.
  - Re-ran client smoke boot via the Playwright web-game client against `http://127.0.0.1:5173`.
  - Inspected fresh screenshot artifact:
    - `output/web-game/shot-0.png`

---

- Follow-up task: allow only doctors to target themselves in the shared night action panel.
- Updated `Client/components/PhaseRouter.tsx`:
  - Night target filtering is now role-aware.
  - `DOCTOR_SAVE` includes the current player in the target list.
  - `MAFIA_KILL_VOTE` and `DETECTIVE_CHECK` still exclude self.

---

- Follow-up task: restyle the voting phase with a more serious courtroom vibe while keeping behavior unchanged.
- Updated `Client/components/PhaseRouter.tsx`:
  - Voting phase now applies a dedicated courtroom variant class to the shared `VotePanel`.
- Updated `Client/src/styles/components/vote-panel.css`:
  - Reworked the voting-phase backdrop into a darker, formal courtroom palette.
  - Added brass/mahogany styling for the voting panel, target rows, and controls.
  - Styled the spectator note to match the courtroom presentation.
- Validation:
  - Generated and inspected a disposable courtroom preview screenshot:
    - `output/web-game/shot-0.png`
  - Deleted the temporary preview HTML after use.

---

- Follow-up task: recover accidentally reverted post-`PATCH 0.9.10` UI/type changes.
- Restored `GAMEOVER` redesign:
  - `Client/components/PhaseRouter.tsx`
  - `Client/pages/Game.tsx`
  - `Client/src/styles/pages/game.css`
  - `Client/src/styles/phases/gameover.css`
- Restored client type-safety cleanup:
  - `Client/components/PhaseRouter.tsx` now omits optional night target icon props unless they exist.
  - `Client/components/RoleRollOverlay.tsx` now normalizes fallback image values to `null` through a shared helper.
- Validation:
  - Ran `npm exec -- tsc -p tsconfig.json --noEmit` inside `Client` after restoring the reverted changes.

---

- Follow-up task: add a `How to Play` popup to the main menu instead of a separate page.
- Updated `Client/pages/MainMenu.tsx`:
  - Added a `How to Play` button under `Role Assigner`.
  - Added a centered modal popup with close button, outside-click close, and `Esc` close.
  - Added simple beginner-friendly sections for:
    - Classic Mafia
    - Classic Mafia Flow
    - Role Assigner
    - BOCT Importer
- Updated `Client/src/styles/pages/main-menu.css`:
  - Added modal/backdrop styling that matches the menu screens while keeping the content readable.
  - Added styles for the new `How to Play` trigger button and modal sections.
- Validation:
  - Ran `npm exec -- tsc -p tsconfig.json --noEmit` inside `Client`.

---

- Follow-up task: reveal mafia/doctor partners right after the role roll, but only once per game and never again on reconnect.
- Added `Client/components/PartnerRevealOverlay.tsx`:
  - New post-roll teammate reveal overlay for `MAFIA` and `DOCTOR`.
  - Shows partner names only.
  - Uses a simple `Continue` acknowledgment instead of replaying automatically later.
- Added `Client/src/styles/components/partner-reveal-overlay.css`:
  - Styled the partner reveal to match the existing role-roll/menu visual language.
- Updated `Client/src/roleRoll.ts`:
  - Added shared session-storage key helpers for role-roll and partner-reveal tracking.
- Updated `Client/pages/Game.tsx`:
  - Classic mode now queues a partner reveal after the role roll when the player is `MAFIA` or `DOCTOR` and has at least one partner.
  - Dealer-only/spectator players still receive no role roll and no partner reveal.
  - Partner reveals are gated per `(room, gameNumber, clientId)` so reconnects do not show them again.
- Updated `Client/pages/Lobby.tsx`:
  - Role selector regular-mafia mode now does the same post-roll partner reveal in the lobby deal flow.
  - BOCT mode is explicitly excluded.

---

- Follow-up task: refresh docs for the current release state and align package metadata to `1.0.0`.
- Updated `README.md`:
  - Rewrote the root README to match the current shipped feature set.
  - Added clear sections for Classic mode, Role Assigner, BOTC importing, install steps, and developer setup.
  - Updated installer references to `Mafia Local Setup 1.0.0.exe`.
- Updated `docs/GDD.md`:
  - Refreshed the GDD around the current product shape instead of the older prototype scope.
  - Documented the two room modes, current roles, current phase flow, teammate reveal behavior, UI direction, and future-work boundaries.
- Updated version metadata to `1.0.0` in:
  - `package.json`
  - `package-lock.json`
  - `Mafia-Local/Client/package.json`
  - `Mafia-Local/Client/package-lock.json`
  - `Mafia-Local/Server/package.json`
  - `Mafia-Local/Server/package-lock.json`
  - `Mafia-Local/Electron/package.json`
  - `Mafia-Local/Electron/package-lock.json`
- Validation:
  - `npm run build`
  - `npm run dist`
- Cleanup:
  - Removed the older `Mafia Local Setup 0.9.5.exe` and matching blockmap from `Mafia-Local/Electron/dist` so only the `1.0.0` installer artifacts remain.

---

- Follow-up task: split rotating placeholder text groups so Day can have its own set while both discussion phases share one set.
- Updated `Client/components/PhaseRouter.tsx`:
  - Replaced the single shared placeholder text array with:
    - `DAY_PHASE_PLACEHOLDER_TEXTS`
    - `DISCUSSION_PHASE_PLACEHOLDER_TEXTS`
  - Updated the rotating placeholder component to accept a `texts` prop.
  - Wired Day to its own placeholder set.
  - Wired both Private Discussion and Public Discussion to the shared discussion placeholder set.

---

- Follow-up task: rename the `DISCUSSION` phase header to `Private Discussion` while leaving `Public Discussion` unchanged.
- Updated `Client/src/uiMeta.ts`:
  - Changed the `DISCUSSION` phase label from `Discussion` to `Private Discussion`.
  - Updated the short label to `Private`.

---

- Follow-up task: make rotating phase placeholder text cycle randomly instead of in a fixed order.
- Updated `Client/components/PhaseRouter.tsx`:
  - Added a random placeholder index helper.
  - Rotating placeholder text now starts from a random entry.
  - Each rotation now picks a random next entry instead of stepping sequentially.
  - Prevented immediate back-to-back repeats when more than one placeholder exists.

---

- Follow-up task: apply the `Special Elite` font to the in-app game top-bar title.
- Updated `Client/src/styles/global.css`:
  - Imported the `Special Elite` web font.
  - Added `--ui-font-display` for display-title usage.
- Updated `Client/src/styles/pages/game.css`:
  - Applied the display font to `.game-phase-topbar__phase`.
  - Added slight tracking to help the title read cleanly.

---

- Follow-up task: revert the `Special Elite` title-font experiment.
- Updated `Client/src/styles/global.css`:
  - Removed the `Special Elite` font import.
  - Removed the temporary display-font CSS variable.
- Updated `Client/src/styles/pages/game.css`:
  - Restored the game top-bar title to the default app typography.
  - Removed the temporary title tracking added for the font experiment.

---

- Follow-up task: apply `Special Elite` to the custom Electron title bar scaffold.
- Updated `Electron/ui/titlebar.css`:
  - Imported the `Special Elite` font.
  - Applied it to `.app-titlebar__label`.
  - Added slight letter spacing for readability.
- Note:
  - This file is still a scaffold and not wired into the live Electron window yet, so this change prepares the title bar styling without changing the active app window frame.

---

- Follow-up task: fully wire the custom Electron title bar.
- Added `Electron/preload.cjs`:
  - Exposed `window.mafiaWindow` bridge methods for minimize, maximize/restore, close, maximize state reads, and maximize state change events.
- Updated `Electron/main.js`:
  - Switched the main host window to frameless mode.
  - Hid the native menu bar to let the custom title bar own the window chrome.
  - Wired preload into the BrowserWindow.
  - Added IPC handlers for window controls.
  - Broadcast maximize state changes back to the renderer.
  - Fixed the Electron runtime import so the main process boots correctly under the current ESM setup.
- Added `Client/components/ElectronTitleBar.tsx`:
  - Renderer-mounted custom title bar using the existing Electron titlebar stylesheet.
  - Added minimize, maximize/restore, and close buttons.
  - Added maximize-state-aware icon swapping.
- Updated `Client/src/App.tsx`:
  - Wrapped the app in an Electron-only shell when `window.mafiaWindow` is available.
  - Mounted the custom title bar above the app content.
- Updated `Client/src/vite-env.d.ts`:
  - Declared the `window.mafiaWindow` bridge shape for TypeScript.
- Updated `Electron/ui/titlebar.css`:
  - Expanded the scaffold into a live title bar style with shell layout, control icons, and content-height overrides.
- Updated `Electron/ui/titlebar.contract.md` and `Electron/ui/README.md`:
  - Marked the title bar as implemented and documented the active bridge behavior.

---

- Follow-up task: verify the live custom Electron title bar end-to-end.
- Investigation notes:
  - The renderer/titlebar bridge pieces are in place (`Electron/preload.cjs`, `Client/components/ElectronTitleBar.tsx`, `Client/src/App.tsx`, `Electron/ui/titlebar.css`).
  - The remaining blocker is the Electron main-process API import on this Windows setup.
- Verified runtime failures while testing the frameless window wiring:
  - `import { app, BrowserWindow } from "electron"` failed due missing named exports.
  - `import { app, BrowserWindow, ipcMain } from "electron/main"` failed due missing named exports.
  - `import * as electron from "electron/main"` produced an empty module shape for the user app entrypoint on this machine.
  - A `.cjs` main entry with `require("electron")` returned the executable-path string instead of the Electron API object.
  - `require("electron/main")` failed to resolve at runtime.
- Mitigation attempt:
  - Upgraded local Electron in `Mafia-Local/Electron` from `39.2.7` to `41.0.2`.
  - Re-ran the main-process import test; the same blocker persisted.
- Validation:
  - `Electron`: `npm run build` passes.
  - `Electron`: `npm run dist` passes and now packages against Electron `41.0.2`.
- Next-step suggestion:
  - Before more titlebar code churn, confirm whether to continue with a version/runtime workaround strategy, because the unresolved part is now Electron’s Windows main-process API loading rather than the app UI implementation itself.

---

- Follow-up task: keep the live custom title bar as-is and remove safe stale pieces only.
- Cleanup performed:
  - Removed unused Electron dev dependency `electron-reloader`.
  - Refreshed `Client/src/styles/README.md` so it reflects the current wired style structure instead of the old scaffold-only note.
- Validation:
  - Ran `npm run build` in `Mafia-Local/Electron`.
  - Ran `npm run dist` in `Mafia-Local/Electron`.

---

- Follow-up task: convert the remaining temporary host tools into normal supported features and clear the temp feature list.
- Updated `Client/pages/Lobby.tsx`:
  - Removed the testing wording from the classic `Add Bot` host control.
- Updated `Client/pages/Game.tsx`:
  - Renamed local phase-skip variables away from testing-only naming.
  - Removed the testing wording from the host phase-skip control tooltip.
- Updated docs:
  - `README.md` now lists Add Bot and phase skip as supported host features.
  - `docs/GDD.md` now treats Add Bot and phase skip as normal implemented features.
  - Removed the old open question about temporary host testing tools.
- Updated `temporary features.txt`:
  - Cleared the file so it is empty for future temporary items.

---

- Release-prep pass for the `1.0.0` launch candidate.
- Updated `Client/components/PhaseRouter.tsx`:
  - Replaced the live `PH`-style rotating placeholder copy with production-ready Day and Discussion text.
  - Cleaned the old placeholder-screen section comment.
- Updated `Client/src/styles/global.css`:
  - Reframed the top comment from scaffold wording to baseline/shared-styles wording.
- Updated server comments:
  - `Server/index.ts`
  - `Server/rooms.ts`
  - Removed stale testing-helper phrasing where the features are now part of normal host/admin flows.
- Updated package metadata:
  - `package.json`
  - `Client/package.json`
  - `Server/package.json`
  - `Electron/package.json`
  - Added real release-ready descriptions.
- Updated docs:
  - `README.md` now links to dedicated release notes.
  - Added `docs/release-1.0.0.md` with highlights, scope, installer path, and a launch checklist.
