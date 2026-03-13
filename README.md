# Mafia

Version: 1.0.0

Mafia is a local-first social deduction game built for in-person play.
One device runs the host app, players join from phones or browsers on the same network, and the app handles room flow, role assignment, phase changes, voting, and result screens.

## What Is In 1.0.0

- Classic Mafia mode with a full game flow
- Role Assigner mode for groups that want to deal roles without using the full game flow
- Blood on the Clocktower script import inside Role Assigner
- Desktop host app through Electron
- Mobile-friendly player screens
- In-game role roll animation
- Mafia and Doctor partner reveal after role roll when there are multiple teammates
- Dealer-only host option
- Manual role assignment toggle for custom setups
- Host `Add Bot` support in classic lobbies
- Host phase-skip control during live classic games
- Join by room code, QR code, or invite link on the local network

## Modes

### Play Game

This is the full Classic Mafia mode.

Current supported roles:
- Civilian
- Mafia
- Doctor
- Detective
- Sheriff

Classic flow:
1. Players join the lobby
2. Host adjusts timers and role counts
3. Players ready up or the host force starts
4. Roles are assigned with a role-roll reveal
5. If there are 2 or more Mafia or 2 or more Doctors, teammates are revealed right after the role roll
6. The game proceeds through Day, Private Discussion, Public Discussion, Voting, and Night
7. The game ends on the Game Over screen when a win condition is reached

### Role Assigner

This mode is for groups that want the app to deal roles, but do not want to use the full automated phase flow.

Current supported options:
- Regular Mafia role dealing
- Blood on the Clocktower script import
- Redeal control
- Host can act as dealer-only
- Players only see their own role
- Host sees counts and room controls without exposing player roles
- Room locks once roles are dealt

## How To Play Classic Mafia

Very simply:
- The Mafia are trying to remove enough civilians to control the game.
- The Civilians are trying to find and eliminate all Mafia.
- Special roles help the Civilians gather information or protect players.

Role summary:
- Civilian: no night action
- Mafia: votes on a kill target during Night
- Doctor: chooses a player to save during Night and can self-save once per game
- Detective: investigates one player during Night and learns whether they are Mafia
- Sheriff: can use a one-time shot during the allowed daytime phases

## Install For Players

1. Open the repository releases page.
2. Download the latest installer: `Mafia Local Setup 1.0.0.exe`.
3. Run the installer.
4. Launch `Mafia` from the Start Menu or desktop shortcut.
5. If Windows SmartScreen appears, choose `More info` and then `Run anyway`.
6. If you are hosting on LAN, allow the app through Windows Firewall on private networks.

Players do not need Node.js or any coding tools.

## Development Setup

### Prerequisites

- Node.js 20+
- npm
- Windows for packaging the Electron installer

### Install Dependencies

```powershell
cd Mafia-Local/Client
npm install

cd ../Server
npm install

cd ../Electron
npm install
```

### Run In Development

Use 2-3 terminals.

1. Start the server

```powershell
cd Mafia-Local/Server
npm run dev
```

2. Start the client

```powershell
cd Mafia-Local/Client
npm run dev
```

3. Start Electron against the dev server

```powershell
cd Mafia-Local/Electron
$env:ELECTRON_USE_DEV_SERVER='1'
npm run dev
```

### Build The Desktop Installer

```powershell
cd Mafia-Local/Electron
npm run dist
```

Installer output:
- `Mafia-Local/Electron/dist/Mafia Local Setup 1.0.0.exe`
- `Mafia-Local/Electron/dist/Mafia Local Setup 1.0.0.exe.blockmap`

## Project Layout

- `Mafia-Local/Client` - React/Vite player and host UI
- `Mafia-Local/Server` - authoritative game server and room logic
- `Mafia-Local/Shared` - shared event payloads and common types
- `Mafia-Local/Electron` - desktop host wrapper and packaging
- `docs/GDD.md` - game design document

## Current Notes

- This project is built first for local play.
- Online matchmaking and remote hosting are still future work.
- Empty placeholder UI files may exist for future UI work and should not be treated as dead code by default.
