# Mafia

Mafia, the game that either strengthens frienships or ruins them 😛
Play this with friends to find out who the best liar, detective, or maybe even the dumbest!

# How The Game Works❗

* When the game first begins, roles will be assigned to different players in the game.

* This role will determine your objective in the game.

* For those who are innocent or have roles that help the civilians, your job is to find who is, or are, the impostor / murderer.

* For the impostor, your job is to eliminate all civilians.

* Throughout the game there will be 2 different "cycles", a day and a night cycle.

* The day cycle primarily has 4 phases
    - Phase 1: Story telling
    - Phase 2: Private Discussions
    - Phase 3: Public Discussions
    - Phase 4: Voting

* The night cycle consists of only 1 phase:
    - This phase is what I call the "Role Phase"

* To understand any of the phases of the game or any part of the game please refer to the "How To Play" section.

* NOTE: You may have your own rules, scripts, or different way of running the game, this app is only meant to help with the flow
      of the game, or teach new players how to play the game.
      
      I will eventually add different scripts / modes that adds more roles and more complex and interesting gameplay.

# How To Play❓

** MAY NEED A STORY TELLER / GAME MASTER **

🕵️ Roles Assignment - Each player will be a given a random role, based on which version of mafia is played.
📖 Story Telling - Story is told, setting the scene for the game, during this time the story teller will also tell the players what happened during the night time,
                    in this case, it will be shown to the players through their phones who has died and who was saved and such.
💬 Private Discussion - Players are now able to pull other players aside to talk to them to gather info.
🗣️ Public Discussion - Players are no longer allowed to talk privately and must discuss their findings with the group.
⁉️ Voting Phase - Players will now vote who they think the mafia / impostor is.
            (NOTE: If two players recieve an equal amount of votes, those two players will be able to defend themselves.
            This will also start another voting phase where players must vote ONLY between those two players)
👹 Roles / Night - Each player with a role may now use their abilities, if applicable.
🔁 Loops back to story and so on.

# Roles 

* The simpler version of the game only consists of 4 roles.
    - Civilian / Innocent
        - No special ability, stays "asleep" at night

    - Doctor
        - Is able to save one person per "Role Phase" or at night
        - Can only save themselves once per game (yes the WHOLE game)
        - These roles may vary depending on how you guys may want to play the game 
        (Updates to support certain features like this will come in the future)

    - Detective / Sherrif
        - Can "Investigate" one person a night
        - Allows this role to see whether someone is Killer or Civilian

    - Killer / Impostor / Murderer
        - Gets to kill a player each night

# Install (Players)

1. Open this repository on GitHub and go to the `Releases` page.
2. Download the latest installer: `Mafia Local Setup <version>.exe`.
3. Run the installer and complete setup.
4. Launch `Mafia Local` from the Start Menu.
5. If Windows SmartScreen appears, click `More info` then `Run anyway`.
6. If hosting a LAN room, allow the app through Windows Firewall on private networks (port `3100`).

No Node.js or coding tools are required for players.

# Setup (Developers)

## Prerequisites

- Node.js 20+ and npm.
- Windows for desktop packaging steps below.

## Install Dependencies

Run these once:

```powershell
cd Mafia-Local/Client
npm install

cd ../Server
npm install

cd ../Electron
npm install
```

## Run In Development

Use 2-3 terminals:

1. Server

```powershell
cd Mafia-Local/Server
npm run dev
```

2. Client (web)

```powershell
cd Mafia-Local/Client
npm run dev
```

3. Electron wrapper (optional)

```powershell
cd Mafia-Local/Electron
$env:ELECTRON_USE_DEV_SERVER='1'
npm run dev
```

## Build Desktop Installer

```powershell
cd Mafia-Local/Electron
npm run dist
```

Output files:

- `Mafia-Local/Electron/dist/Mafia Local Setup <version>.exe`
- `Mafia-Local/Electron/dist/Mafia Local Setup <version>.exe.blockmap`

## Publish A Release

1. Create a new GitHub release (for example `v0.7.5`).
2. Upload the installer from `Mafia-Local/Electron/dist`.
3. Publish release so players can download it directly.
