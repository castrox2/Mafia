🎭 Mafia — GDD
1. Game Overview

Title: Mafia Local
Genre: Party / Social Deduction
Platform (current): Local desktop app (Electron) + phones/browsers on same network
Platform (future): Online web-based version
Players: 4–20 (ideal: 6–12)
Session Length: 10–30 minutes

Core Concept:
A digital version of the party game Mafia, designed to be easy to host locally. One device acts as the host/server, while players join using their phones or browsers via a room code. The game manages roles, phases, and voting automatically.

2. Design Goals
Primary Goals

Easy to host locally (no accounts, no setup friction)

Works well in person (party / hangout setting)

Supports phones as player devices

Minimal UI, clear state

Fast iteration for dev team

Non-Goals (for now)

No matchmaking

No ranking or progression

No persistence / accounts

No voice chat

No moderation system

3. Target Audience

Friend groups

Party settings

Casual players

People familiar with Mafia / Werewolf rules

Players who want automation instead of manual role handling

4. Core Gameplay Loop

Host creates or joins a room

Players join via room code (phone or browser)

Lobby phase

Roles assigned secretly

Night phase (roles act)

Day phase (discussion)

Voting phase

Elimination

Repeat until win condition met

5. Game Phases
5.1 Lobby

Players join/leave

Host controls settings

Game mode selection

Start game button (host only)

5.2 Night

Mafia selects a target

Special roles act (if enabled)

Actions are hidden

5.3 Day

Results revealed (who died)

Players discuss

Timer optional

5.4 Voting

Players vote to eliminate

Majority vote removes player

Ties resolved by ruleset

5.5 End

Win condition check

Display winning team

Option to restart

6. Roles (Initial)
Core Roles

Civilian – no special ability

Mafia – votes to kill at night

Optional Roles (future)

Doctor (save one player)

Detective (inspect one player)

Narrator (AI / host-controlled)

7. Game Modes (Planned)

Classic Mafia

Fast Mafia (shorter timers)

Custom Roles

Party Mode (larger groups, relaxed rules)

Each mode defines:

Allowed roles

Player limits

Phase timers

Win conditions

8. Win Conditions
Mafia Wins When:

Mafia count ≥ civilian count

Civilians Win When:

All mafia eliminated

9. UI / UX Design
Player UI (Phone / Browser)

Join screen (name + room code)

Role reveal screen (private)

Phase indicator (Night / Day / Vote)

Action buttons (role-specific)

Voting interface

Host UI (Electron)

Lobby overview

Player list

Game state display

Start / End game

Debug info (dev-only)

10. Technical Design (High-Level)
Architecture

Local server (Node + Express + Socket.IO)

Electron wrapper for host

Clients connect via browser

Server Authority

Server owns all game state

Clients are dumb renderers

No trust in client input

Networking

WebSockets (Socket.IO)

Room-based architecture

Real-time updates

11. Current Implementation Status
Implemented

Local server

Room creation/joining

Player join/leave

Multi-device support

Electron host

Live reload (dev)

In Progress

UI layout

Lobby polish

Planned

Role assignment

Game phases

Voting logic

Host controls

Online deployment

12. Development Phases
Phase 1 — Infrastructure ✅

Server

Rooms

Networking

Phase 2 — Lobby UI

Player list

Host controls

Room management

Phase 3 — Core Gameplay

Roles

Night/day cycle

Voting

Phase 4 — Polish

UX improvements

Animations

Error handling

Phase 5 — Online Version

Remote hosting

Scaling

Security hardening

13. Open Questions / Future Decisions

AI narrator implementation

Custom role builder

Moderation tools (online version)

Persistence / accounts (optional)