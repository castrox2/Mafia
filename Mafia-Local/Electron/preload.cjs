const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("mafiaWindow", {
  isElectron: true,
  minimize: () => ipcRenderer.invoke("mafia-window:minimize"),
  maximize: () => ipcRenderer.invoke("mafia-window:maximize"),
  close: () => ipcRenderer.invoke("mafia-window:close"),
  isMaximized: () => ipcRenderer.invoke("mafia-window:is-maximized"),
  onMaximizeChange: (handler) => {
    if (typeof handler !== "function") {
      return () => {}
    }

    const wrapped = (_event, isMaximized) => {
      handler(Boolean(isMaximized))
    }

    ipcRenderer.on("mafia-window:maximize-change", wrapped)
    return () => {
      ipcRenderer.removeListener("mafia-window:maximize-change", wrapped)
    }
  },
})
