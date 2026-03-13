# Mafia - Game Design Document

Version: 1.0.0

## 1. Overview

Title: Mafia
Genre: Party / Social Deduction
Current Platform: Local desktop host app (Electron) with browser/phone clients on the same network
Future Platform: Online hosted version
Players: 4-20
Ideal Session Length: 10-30 minutes

Mafia is designed for in-person groups that want the structure of a moderator-assisted social deduction game without needing one person to manually track every role, vote, and phase.

The host runs the game locally. Players join by room code, QR code, or local invite link. The server remains authoritative for role assignment, timers, eliminations, and win checks.

## 2. Product Goals

Primary goals:
- Fast local setup with no accounts
- Works well on phones during in-person play
- Clear and spoiler-safe private information delivery
- Host-friendly desktop packaging
- Support both full game flow and lightweight role dealing

Non-goals for 1.0.0:
- Online matchmaking
- User accounts or persistence
- Cross-room moderation systems

## 3. Current Play Modes

### 3.1 Play Game

This is the full Classic Mafia mode.

Players join a room, the host configures timers and role counts, and the game runs through the automated phase loop.

Current classic roles:
- Civilian
- Mafia
- Doctor
- Detective
- Sheriff

### 3.2 Role Assigner

This is a separate room type for groups that want to deal roles without running the full automated game loop.

Current role assigner capabilities:
- Regular Mafia role dealing
- Blood on the Clocktower script import
- Dealer-only host option
- Redeal support
- Locked room after dealing
- Players only see their own role
- Host sees counts and room controls without exposing assigned roles

## 4. Core Gameplay Loop

### 4.1 Classic Flow

1. Host creates a Classic room
2. Players join with a name and room code
3. Lobby opens with host settings, readiness, and room info
4. Host starts the game or force starts
5. Role roll animation reveals each player's role
6. If a player is Mafia or Doctor and has teammates, the app reveals partner names immediately after the role roll
7. The game progresses through the phase loop
8. Win condition is checked after key transitions
9. The Game Over screen shows the winning team and next-step actions

### 4.2 Phase Loop

Current classic phase sequence:
- Day
- Private Discussion
- Public Discussion
- Voting
- Night

Notes:
- Timers are host-configurable
- Some phases are presentation-heavy, while Night and Voting include target selection actions
- The Sheriff action is available only during the allowed daytime phases and only once per game

## 5. Roles and Rules

### Civilian
- No special action
- Wins when all Mafia are eliminated

### Mafia
- Participates in the Night kill vote
- If there are 2 or more Mafia, partner names are revealed after the role roll
- Wins when Mafia count is greater than or equal to the remaining civilian-side count

### Doctor
- Saves one player during Night
- Can self-save once per game
- If there are 2 or more Doctors, partner names are revealed after the role roll

### Detective
- Investigates one player during Night
- Learns whether the checked player is Mafia
- Limited to one investigation per Night phase

### Sheriff
- Has a one-time shot during the allowed daytime phases
- Action is tracked server-side and publicly announced when used

## 6. UX / UI Direction

The project currently uses a strong themed visual language:
- Main menu and onboarding screens use a dark gradient card-based presentation
- Day uses a warmer, lighter palette
- Night uses a cooler, darker palette
- Voting uses a more formal courtroom-style treatment
- Game Over matches the menu-style card presentation

Design principles:
- Private information should be easy to read but hard to shoulder-snoop accidentally
- Important actions should be reachable on mobile without requiring zoom
- Long lists must scroll inside their own panel instead of scrolling the full game screen
- UI should support both Electron desktop hosting and phone-sized player views

## 7. Technical Structure

Architecture:
- `Client`: React + Vite UI
- `Server`: Node + Socket.IO authoritative game state
- `Shared`: shared event payloads and common types
- `Electron`: local host wrapper and packaging

Authority model:
- Server owns room state, phases, role assignment, action validation, and win conditions
- Clients render state and send intent only
- Reconnects preserve player identity through stable client IDs

## 8. Current Implemented Features

Implemented in 1.0.0:
- Room creation and join flow
- Main menu split between Play Game and Role Assigner
- Classic game lobby with settings and ready flow
- Host Add Bot support for classic lobby setup
- Host phase-skip control during live classic games
- Classic game phases and win handling
- Role roll animation
- Mafia/Doctor teammate reveal after role roll when applicable
- Role Assigner lobby and regular mafia dealing
- Blood on the Clocktower script import for Role Assigner
- Dealer-only host option
- Reconnect-safe role restoration
- Electron splash screen and installer packaging
- Mobile-friendly layout work across the current screens

## 9. Remaining / Future Work

Planned or likely next areas:
- Further styling polish for remaining phase screens and edge-case states
- Additional roles and role variants
- More BOTC support beyond script import and role visibility
- Better end-of-game recap detail
- Safer release/build automation workflow
- Optional online-hosted mode

## 10. Release Notes For 1.0.0

The 1.0.0 milestone represents the first full release target where the project includes:
- A packaged desktop host app
- A complete playable Classic Mafia flow
- A separate Role Assigner mode
- BOTC script importing in Role Assigner
- Modernized menu, lobby, phase, and game-over UI foundations

## 11. Open Questions

- How much BOTC-specific game support should go beyond importing and viewing scripts?
- Should future custom-role work live inside Classic settings, Role Assigner, or both?
- What should the online architecture look like once local-first scope is complete?
