import * as electron from "electron/main"
import fs from "fs"
import path from "path"
import { fileURLToPath, pathToFileURL } from "url"

const electronMain = electron.default ?? electron
const { app, BrowserWindow, ipcMain } = electronMain

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEV_URL = "http://localhost:5173"
const WINDOW_ICON_PATH = (() => {
  const icoPath = path.join(__dirname, "assets", "Mafia-Icon.ico")
  if (fs.existsSync(icoPath)) return icoPath
  return path.join(__dirname, "assets", "Mafia-Icon.png")
})()
const DEV_RENDERER_URL = process.env.ELECTRON_START_URL || DEV_URL
const PRELOAD_PATH = path.join(__dirname, "preload.cjs")

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

const parsePort = (value, fallback) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const SERVER_PORT = parsePort(process.env.MAFIA_SERVER_PORT || process.env.PORT, 3100)
const SERVER_URL = process.env.ELECTRON_SERVER_URL || `http://127.0.0.1:${SERVER_PORT}`
const SPLASH_MIN_VISIBLE_MS = 2500

let win
let splashWin
let backendStartedInProcess = false
let backendStartPromise = null

/* ------------------------------------------------------
        Renderer source (dev vs packaged)
  - Dev: Vite dev server URL
  - Packaged: local backend + built client
------------------------------------------------------ */

const shouldUseDevRenderer = () => {
  if (process.env.ELECTRON_USE_DEV_SERVER === "1") return true
  if (process.env.ELECTRON_USE_DEV_SERVER === "0") return false
  return !app.isPackaged
}

const shouldAutoStartBackend = () => {
  if (process.env.ELECTRON_START_BACKEND === "1") return true
  return app.isPackaged
}

const getServerEntryPath = () => {
  const appPath = app.getAppPath()
  const candidates = [
    path.join(appPath, "Server", "dist", "Server", "index.js"),
    path.join(appPath, "Server", "dist", "index.js"),
    path.join(__dirname, "..", "Server", "dist", "Server", "index.js"),
    path.join(__dirname, "..", "Server", "dist", "index.js"),
    path.join(__dirname, "Server", "dist", "Server", "index.js"),
    path.join(__dirname, "Server", "dist", "index.js"),
    path.join(process.resourcesPath, "Server", "dist", "Server", "index.js"),
    path.join(process.resourcesPath, "Server", "dist", "index.js"),
    path.join(process.resourcesPath, "app", "Server", "dist", "Server", "index.js"),
    path.join(process.resourcesPath, "app", "Server", "dist", "index.js"),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }

  return null
}

const getPackagedClientIndexPath = () => {
  const appPath = app.getAppPath()
  const candidates = [
    path.join(appPath, "Client", "dist", "index.html"),
    path.join(__dirname, "..", "Client", "dist", "index.html"),
    path.join(process.resourcesPath, "Client", "dist", "index.html"),
    path.join(process.resourcesPath, "app", "Client", "dist", "index.html"),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }

  return null
}

const getPackagedClientDistPath = () => {
  const appPath = app.getAppPath()
  const candidates = [
    path.join(appPath, "Client", "dist"),
    path.join(__dirname, "..", "Client", "dist"),
    path.join(process.resourcesPath, "Client", "dist"),
    path.join(process.resourcesPath, "app", "Client", "dist"),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) return candidate
  }

  return null
}

const isBackendHealthy = async (timeoutMs = 1200) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${SERVER_URL}/health`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
    return res.ok
  } catch (_err) {
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

const isUrlReachable = async (targetUrl, timeoutMs = 1200) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
    return res.ok
  } catch (_err) {
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

const waitForBackendReady = async (timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isBackendHealthy()) return true
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

const startBackend = async ({ force = false } = {}) => {
  if (await isBackendHealthy()) return
  if (!force && !shouldAutoStartBackend()) return

  if (backendStartPromise) {
    await backendStartPromise
    return
  }

  backendStartPromise = (async () => {
    if (await isBackendHealthy()) return

    const serverEntryPath = getServerEntryPath()
    if (!serverEntryPath) {
      throw new Error("Server entry not found. Build Server before launching packaged app.")
    }

    const clientPort = shouldUseDevRenderer() ? "5173" : String(SERVER_PORT)
    process.env.MAFIA_SERVER_PORT = String(SERVER_PORT)
    process.env.MAFIA_CLIENT_PORT = clientPort
    if (!shouldUseDevRenderer()) {
      const packagedClientDistPath = getPackagedClientDistPath()
      if (packagedClientDistPath) {
        process.env.MAFIA_CLIENT_DIST_DIR = packagedClientDistPath
      }
    }

    if (!backendStartedInProcess) {
      await import(pathToFileURL(serverEntryPath).href)
      backendStartedInProcess = true
    }

    const ready = await waitForBackendReady()
    if (!ready) {
      throw new Error("Backend failed to become ready in time.")
    }
  })()

  try {
    await backendStartPromise
  } finally {
    backendStartPromise = null
  }
}

const loadStatusPage = async ({ title, message, bullets = [] }) => {
  if (!win || win.isDestroyed()) return

  const bulletsMarkup = bullets.length
    ? `<ul>${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : ""

  const html = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>
        :root {
          color-scheme: dark;
          font-family: "Segoe UI", system-ui, sans-serif;
        }
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at top left, rgba(125, 65, 255, 0.18), transparent 34%),
            radial-gradient(circle at bottom right, rgba(239, 68, 68, 0.16), transparent 30%),
            #07070c;
          color: #f7f2ff;
        }
        .shell {
          width: min(90vw, 720px);
          padding: 32px;
          border-radius: 22px;
          border: 1px solid rgba(173, 116, 255, 0.35);
          background: rgba(14, 10, 24, 0.92);
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.36);
        }
        h1 {
          margin: 0 0 12px;
          font-size: clamp(30px, 5vw, 42px);
        }
        p {
          margin: 0 0 18px;
          color: rgba(240, 232, 255, 0.82);
          font-size: 16px;
          line-height: 1.6;
        }
        ul {
          margin: 0;
          padding-left: 22px;
          color: rgba(240, 232, 255, 0.92);
          line-height: 1.7;
        }
        strong {
          color: #ffffff;
        }
      </style>
    </head>
    <body>
      <main class="shell">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
        ${bulletsMarkup}
      </main>
    </body>
  </html>`

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

const loadRenderer = async () => {
  if (!win) return

  if (shouldUseDevRenderer()) {
    if (await isUrlReachable(DEV_RENDERER_URL)) {
      await win.loadURL(DEV_RENDERER_URL)
      return
    }

    console.warn(`Dev renderer unavailable at ${DEV_RENDERER_URL}; falling back to built renderer.`)
  }

  try {
    await startBackend({ force: shouldUseDevRenderer() })
  } catch (err) {
    console.error("Backend startup failed:", err)
  }

  if (await isBackendHealthy()) {
    await win.loadURL(SERVER_URL)
    return
  }

  const packagedIndexPath = getPackagedClientIndexPath()
  if (packagedIndexPath) {
    await win.loadFile(packagedIndexPath)
    return
  }

  if (shouldUseDevRenderer()) {
    await loadStatusPage({
      title: "Mafia Couldn’t Start Yet",
      message:
        "The Electron app was started in development mode, but the Vite client was not running and no built fallback was available.",
      bullets: [
        "Start the client with: cd Mafia-Local/Client && npm run dev",
        "Or rebuild first with: cd Mafia-Local/Electron && npm run build",
        `Expected dev renderer URL: ${DEV_RENDERER_URL}`,
      ],
    })
    return
  }

  await loadStatusPage({
    title: "Renderer Not Found",
    message:
      "Mafia could not find a renderer source to display. The packaged backend and built client were both unavailable.",
    bullets: [
      "Rebuild the Electron app with: cd Mafia-Local/Electron && npm run dist",
      `Expected backend URL: ${SERVER_URL}`,
    ],
  })
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const closeSplashWindow = () => {
  if (splashWin && !splashWin.isDestroyed()) {
    splashWin.destroy()
  }
  splashWin = null
}

const createSplashWindow = () => {
  const splashPath = path.join(__dirname, "ui", "splash.html")
  if (!fs.existsSync(splashPath)) return

  const splashOptions = {
    width: 960,
    height: 540,
    minWidth: 960,
    minHeight: 540,
    maxWidth: 960,
    maxHeight: 540,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    center: true,
    show: false,
    alwaysOnTop: true,
    backgroundColor: "#0b1220",
  }

  if (fs.existsSync(WINDOW_ICON_PATH)) {
    splashOptions.icon = WINDOW_ICON_PATH
  }

  splashWin = new BrowserWindow(splashOptions)
  splashWin.setMenuBarVisibility(false)

  splashWin.once("ready-to-show", () => {
    if (splashWin && !splashWin.isDestroyed()) {
      splashWin.show()
    }
  })

  splashWin.on("closed", () => {
    splashWin = null
  })

  splashWin.loadFile(splashPath).catch((error) => {
    console.error("Failed to load splash screen:", error)
  })
}

const emitMaximizeState = (targetWindow) => {
  if (!targetWindow || targetWindow.isDestroyed()) return
  targetWindow.webContents.send("mafia-window:maximize-change", targetWindow.isMaximized())
}

ipcMain.handle("mafia-window:minimize", (event) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender)
  if (!targetWindow) return
  targetWindow.minimize()
})

ipcMain.handle("mafia-window:maximize", (event) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender)
  if (!targetWindow) return
  if (targetWindow.isMaximized()) {
    targetWindow.unmaximize()
  } else {
    targetWindow.maximize()
  }
})

ipcMain.handle("mafia-window:close", (event) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender)
  if (!targetWindow) return
  targetWindow.close()
})

ipcMain.handle("mafia-window:is-maximized", (event) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender)
  if (!targetWindow) return false
  return targetWindow.isMaximized()
})

async function createWindow() {
  const splashStartedAt = Date.now()
  createSplashWindow()

  const windowOptions = {
    width: 1100,
    height: 750,
    show: false,
    backgroundColor: "#05070f",
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  }

  if (fs.existsSync(WINDOW_ICON_PATH)) {
    windowOptions.icon = WINDOW_ICON_PATH
  }

  win = new BrowserWindow(windowOptions)
  win.setMenuBarVisibility(false)
  win.on("maximize", () => emitMaximizeState(win))
  win.on("unmaximize", () => emitMaximizeState(win))
  win.on("enter-full-screen", () => emitMaximizeState(win))
  win.on("leave-full-screen", () => emitMaximizeState(win))

  win.once("ready-to-show", async () => {
    const elapsed = Date.now() - splashStartedAt
    const waitMs = Math.max(0, SPLASH_MIN_VISIBLE_MS - elapsed)
    if (waitMs > 0) await wait(waitMs)

    closeSplashWindow()

    if (win && !win.isDestroyed()) {
      win.show()
    }
  })

  try {
    await loadRenderer()
  } catch (err) {
    console.error("Failed to load renderer:", err)
  }

  // Fallback: if ready-to-show never fires (load issues), still reveal the main window.
  if (win && !win.isDestroyed() && !win.isVisible()) {
    const elapsed = Date.now() - splashStartedAt
    const waitMs = Math.max(0, SPLASH_MIN_VISIBLE_MS - elapsed)
    if (waitMs > 0) await wait(waitMs)

    closeSplashWindow()
    win.show()
  }

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("did-fail-load:", { errorCode, errorDescription, validatedURL })
  })

  win.webContents.on("render-process-gone", (_event, details) => {
    console.error("render-process-gone:", details)
  })

  win.webContents.on("crashed", () => {
    console.error("renderer crashed")
  })

  const openDevTools = process.env.ELECTRON_OPEN_DEVTOOLS === "1"
  if (openDevTools) {
    win.webContents.openDevTools({ mode: "right", activate: false })
  }
}

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error)
})

process.on("unhandledRejection", (reason, _promise) => {
  console.error("Unhandled Rejection at:", "reason:", reason)
})

app.whenReady().then(() => {
  createWindow().catch((error) => {
    console.error("Failed to create main window:", error)
  })
})
