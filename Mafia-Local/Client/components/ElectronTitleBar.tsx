import React from "react"
import "../../Electron/ui/titlebar.css"

const WINDOW_TITLE = typeof document !== "undefined" ? document.title || "Mafia" : "Mafia"

const Logo = () => (
  <img
    src="/assets/Mafia-Icon.png"
    alt="Mafia logo"
    className="app-titlebar__logo"
    draggable={false}
  />
)

export default function ElectronTitleBar() {
  const [isMaximized, setIsMaximized] = React.useState(false)

  React.useEffect(() => {
    const api = window.mafiaWindow
    if (!api) return

    let mounted = true

    api.isMaximized().then((next) => {
      if (!mounted) return
      setIsMaximized(Boolean(next))
    })

    const unsubscribe = api.onMaximizeChange((next) => {
      setIsMaximized(Boolean(next))
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  if (!window.mafiaWindow?.isElectron) return null

  const onMinimize = () => {
    void window.mafiaWindow?.minimize()
  }

  const onMaximize = () => {
    void window.mafiaWindow?.maximize()
  }

  const onClose = () => {
    void window.mafiaWindow?.close()
  }

  return (
    <header
      className="app-titlebar"
      onDoubleClick={onMaximize}
      role="banner"
      aria-label="Window title bar"
    >
      <div className="app-titlebar__left">
        <Logo />
        <span className="app-titlebar__label">{WINDOW_TITLE}</span>
      </div>

      <div className="app-titlebar__controls">
        <button
          type="button"
          className="app-titlebar__button"
          data-action="minimize"
          aria-label="Minimize window"
          title="Minimize"
          onClick={onMinimize}
        >
          <span className="app-titlebar__button-icon app-titlebar__button-icon--minimize" />
        </button>

        <button
          type="button"
          className="app-titlebar__button"
          data-action="maximize"
          aria-label={isMaximized ? "Restore window" : "Maximize window"}
          title={isMaximized ? "Restore" : "Maximize"}
          onClick={onMaximize}
        >
          <span
            className={`app-titlebar__button-icon ${
              isMaximized
                ? "app-titlebar__button-icon--restore"
                : "app-titlebar__button-icon--maximize"
            }`}
          />
        </button>

        <button
          type="button"
          className="app-titlebar__button"
          data-action="close"
          aria-label="Close window"
          title="Close"
          onClick={onClose}
        >
          <span className="app-titlebar__button-icon app-titlebar__button-icon--close" />
        </button>
      </div>
    </header>
  )
}
