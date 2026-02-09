import fs from "fs"
import path from "path"
import { fileURLToPath, pathToFileURL } from "url"
import { app, BrowserWindow } from "electron"

const DEV_URL = "http://localhost:5173"
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WINDOW_ICON_PATH = path.join(__dirname, "assets", "Mafia-Icon.png")
const DEV_RENDERER_URL = process.env.ELECTRON_START_URL || DEV_URL

const parsePort = (value, fallback) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const SERVER_PORT = parsePort(process.env.MAFIA_SERVER_PORT || process.env.PORT, 3100)
const SERVER_URL = process.env.ELECTRON_SERVER_URL || `http://127.0.0.1:${SERVER_PORT}`

let win
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
    path.join(appPath, "Server", "dist", "index.js"),
    path.join(__dirname, "..", "Server", "dist", "index.js"),
    path.join(__dirname, "Server", "dist", "index.js"),
    path.join(process.resourcesPath, "Server", "dist", "index.js"),
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

function createWindow() {
  const windowOptions = {
    width: 1100,
    height: 750,
  }

  if (fs.existsSync(WINDOW_ICON_PATH)) {
    windowOptions.icon = WINDOW_ICON_PATH
  }

  win = new BrowserWindow(windowOptions)

  loadRenderer().catch((err) => {
    console.error("Failed to load renderer:", err)
  })

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

app.whenReady().then(createWindow)
