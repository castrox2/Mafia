import fs from "fs"
import path from "path"
import { fileURLToPath, pathToFileURL } from "url"
import { app, BrowserWindow } from "electron"

const DEV_URL = "http://localhost:5173"
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WINDOW_ICON_PATH = (() => {
  const icoPath = path.join(__dirname, "assets", "Mafia-Icon.ico")
  if (fs.existsSync(icoPath)) return icoPath
  return path.join(__dirname, "assets", "Mafia-Icon.png")
})()
const DEV_RENDERER_URL = process.env.ELECTRON_START_URL || DEV_URL

const parsePort = (value, fallback) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const SERVER_PORT = parsePort(process.env.MAFIA_SERVER_PORT || process.env.PORT, 3100)
const SERVER_URL = process.env.ELECTRON_SERVER_URL || `http://127.0.0.1:${SERVER_PORT}`
const SPLASH_MIN_VISIBLE_MS = 900

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

const waitForBackendReady = async (timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isBackendHealthy()) return true
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

const startBackend = async () => {
  if (await isBackendHealthy()) return
  if (!shouldAutoStartBackend()) return

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

const loadRenderer = async () => {
  if (!win) return

  if (shouldUseDevRenderer()) {
    await win.loadURL(DEV_RENDERER_URL)
    return
  }

  try {
    await startBackend()
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

  console.warn("Packaged renderer source not found; falling back to dev URL.")
  await win.loadURL(DEV_RENDERER_URL)
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
    width: 540,
    height: 380,
    minWidth: 540,
    minHeight: 380,
    maxWidth: 540,
    maxHeight: 380,
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

async function createWindow() {
  const splashStartedAt = Date.now()
  createSplashWindow()

  const windowOptions = {
    width: 1100,
    height: 750,
    show: false,
    backgroundColor: "#05070f",
  }

  if (fs.existsSync(WINDOW_ICON_PATH)) {
    windowOptions.icon = WINDOW_ICON_PATH
  }

  win = new BrowserWindow(windowOptions)

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
