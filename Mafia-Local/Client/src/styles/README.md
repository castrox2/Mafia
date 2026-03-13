Client styles for the current UI implementation.

Current structure:

- `global.css`: shared tokens, resets, and shell-level utilities.
- `pages/*`: page-level styles for menu, join, lobby, and game screens.
- `phases/*`: phase-specific styles layered on top of the game screen.
- `components/*`: reusable component styles such as vote panels and overlays.

Note:

- Some files still exist as placeholders for future UI work.
- Empty placeholder files are intentional and should not be treated as dead code by default.
