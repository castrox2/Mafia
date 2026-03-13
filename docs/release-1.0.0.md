# Mafia 1.0.0 Release Notes

## Highlights

- Full Classic Mafia game flow from lobby to game over
- Separate Role Assigner mode for regular Mafia and BOCT role dealing
- BOCT script import support inside Role Assigner
- Electron desktop host app with installer, splash screen, and custom window title bar
- Mobile-friendly player experience for joining, role reveals, and phase screens
- Role roll animation with teammate reveal for multi-Mafia and multi-Doctor games

## Included In 1.0.0

- Play Game main-menu flow
- Role Assigner main-menu flow
- Classic lobby host settings
- Dealer-only host option
- Manual role assignment toggle
- Add Bot support for classic lobbies
- Host phase-skip control during classic games
- QR code and invite-link joining on the local network
- Day, Private Discussion, Public Discussion, Voting, Night, and Game Over screens

## Known Scope Limits

- Local-first release only
- No online matchmaking
- No player accounts or persistence
- BOCT support currently focuses on script import and role dealing, not full automated BOTC gameplay

## Installer

Current Windows installer artifact:

- `Mafia-Local/Electron/dist/Mafia Local Setup 1.0.0.exe`

## Recommended Release Checklist

- Install from the packaged `.exe` on a clean Windows machine
- Verify splash screen, title bar controls, desktop shortcut, and app icon
- Test one full Classic game on LAN
- Test one Role Assigner regular Mafia room
- Test one BOCT import and role deal
- Confirm release notes, README, and GDD all match the shipped build
