Custom title bar contract.

Expected renderer DOM shape:

- Root container: `.app-titlebar`
- Left group: `.app-titlebar__left`
- Logo image: `.app-titlebar__logo`
- Label text: `.app-titlebar__label`
- Controls group: `.app-titlebar__controls`
- Control buttons: `.app-titlebar__button` with `data-action`:
  - `minimize`
  - `maximize`
  - `close`

Bridge API:

- `window.mafiaWindow.minimize()`
- `window.mafiaWindow.maximize()`
- `window.mafiaWindow.close()`
- `window.mafiaWindow.isMaximized()`
- `window.mafiaWindow.onMaximizeChange(handler)`

Current implementation notes:

- The Electron host window is frameless and uses a renderer-mounted custom title bar.
- The title bar is only shown inside Electron, not in the normal browser/mobile client.
- `window.mafiaWindow.maximize()` toggles maximize/restore for the custom maximize button.
