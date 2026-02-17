Custom title bar scaffold contract (not implemented/wired yet).

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

Expected bridge API (future preload wiring):

- `window.mafiaWindow.minimize()`
- `window.mafiaWindow.maximize()`
- `window.mafiaWindow.close()`
- `window.mafiaWindow.isMaximized()`
- `window.mafiaWindow.onMaximizeChange(handler)`

None of this is active yet; this file only defines the implementation target.
