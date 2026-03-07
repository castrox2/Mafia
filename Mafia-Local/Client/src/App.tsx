import React, { useEffect, useState } from "react"
import MainMenu from "../pages/MainMenu.js"
import Join from "../pages/Join.js"
import Lobby from "../pages/Lobby.js"
import Game from "../pages/Game.js"
import { onReconnected } from "./socket.js"

type EntryMode = "PLAY_GAME" | "ROLE_ASSIGNER"

export default function App() {
  const [screen, setScreen] = useState<"MENU" | "JOIN" | "LOBBY" | "GAME">("MENU")
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null)

  const [roomId, setRoomId] = useState("")
  const [playerName, setPlayerName] = useState("")
  const [joinUrl, setJoinUrl] = useState("")
  const [qrDataUrl, setQrDataUrl] = useState("")

  useEffect(() => {
    // Subscribe via buffered handler so we can't miss the event
    return onReconnected(({ roomId, playerName }) => {
      setRoomId(roomId)
      setPlayerName(playerName)

      // IMPORTANT:
      // On reconnect we return to LOBBY by default.
      // Game screen can be entered when server emits "gameStarted".
      setScreen("LOBBY")
    })
  }, [])

  const onExit = () => {
    const hadEntryMode = entryMode != null

    setRoomId("")
    setPlayerName("")
    setJoinUrl("")
    setQrDataUrl("")
    setScreen(hadEntryMode ? "JOIN" : "MENU")

    // Optional: clear URL query if QR brought you here
    window.history.replaceState({}, "", "/")
  }

  if (screen === "MENU") {
    return (
      <MainMenu
        onSelectPlayGame={() => {
          setEntryMode("PLAY_GAME")
          setScreen("JOIN")
        }}
        onSelectRoleAssigner={() => {
          setEntryMode("ROLE_ASSIGNER")
          setScreen("JOIN")
        }}
      />
    )
  }

  /* ------------------------------------------------------
        JOIN screen
    - If we don't have roomId/playerName, we must be in Join.
    - This avoids accidental Lobby/Game rendering with missing state.
  ------------------------------------------------------ */
  if (!roomId || !playerName || screen === "JOIN") {
    return (
      <div className="ui-app-shell ui-app-shell--join">
        <Join
          mode={entryMode ?? "PLAY_GAME"}
          onBackToMenu={() => {
            setEntryMode(null)
            setScreen("MENU")
          }}
          onEnterLobby={(newRoomId, name, joinUrl, qrDataUrl) => {
            setRoomId(newRoomId)
            setPlayerName(name)
            setJoinUrl(joinUrl)
            setQrDataUrl(qrDataUrl)

            setScreen("LOBBY")
          }}
        />
      </div>
    )
  }

  /* ------------------------------------------------------
        GAME screen
    - Entered when Lobby tells us game started.
    - Game.tsx should NOT auto-join (prevents duplicates).
  ------------------------------------------------------ */
  if (screen === "GAME") {
    return (
      <div className="ui-app-shell ui-app-shell--game">
        <Game
          roomId={roomId}
          playerName={playerName}
          onExit={onExit}
          onBackToLobby={() => setScreen("LOBBY")}
        />
      </div>
    )
  }

  /* ------------------------------------------------------
        LOBBY screen (default once in a room)
  ------------------------------------------------------ */
  return (
    <div className="ui-app-shell ui-app-shell--lobby">
      <Lobby
        roomId={roomId}
        playerName={playerName}
        joinUrl={joinUrl}
        qrDataUrl={qrDataUrl}
        onExit={onExit}
        onEnterGame={() => setScreen("GAME")}
      />
    </div>
  )
}
