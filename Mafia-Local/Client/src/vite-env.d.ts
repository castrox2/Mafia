/// <reference types="vite/client" />

declare module "*.css"

type MafiaWindowApi = {
  isElectron: boolean
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onMaximizeChange: (handler: (isMaximized: boolean) => void) => () => void
}

interface Window {
  mafiaWindow?: MafiaWindowApi
}
