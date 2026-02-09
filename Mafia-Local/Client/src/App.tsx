import React, { useEffect, useState } from "react"
import Join from "../pages/Join.js"
import Lobby from "../pages/Lobby.js"
import Game from "../pages/Game.js"
import { onReconnected } from "./socket.js"

export default function App() {
  const [screen, setScreen] = useState<"JOIN" | "LOBBY" | "GAME">("JOIN")

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
    setRoomId("")
    setPlayerName("")
    setJoinUrl("")
    setQrDataUrl("")
    setScreen("JOIN")

    // Optional: clear URL query if QR brought you here
    window.history.replaceState({}, "", "/")
  }

  /* ------------------------------------------------------
        JOIN screen
    - If we don't have roomId/playerName, we must be in Join.
    - This avoids accidental Lobby/Game rendering with missing state.
  ------------------------------------------------------ */
  if (!roomId || !playerName || screen === "JOIN") {
    return (
      <Join
        onEnterLobby={(newRoomId, name, joinUrl, qrDataUrl) => {
          setRoomId(newRoomId)
          setPlayerName(name)
          setJoinUrl(joinUrl)
          setQrDataUrl(qrDataUrl)

          setScreen("LOBBY")
        }}
      />
    )
  }

  /* ------------------------------------------------------
        GAME screen
    - Entered when Lobby tells us game started.
    - Game.tsx should NOT auto-join (prevents duplicates).
  ------------------------------------------------------ */
  if (screen === "GAME") {
    return (
      <Game
        roomId={roomId}
        playerName={playerName}
        onExit={onExit}
        onBackToLobby={() => setScreen("LOBBY")}
      />
    )
  }

  /* ------------------------------------------------------
        LOBBY screen (default once in a room)
  ------------------------------------------------------ */
  return (
    <Lobby
      roomId={roomId}
      playerName={playerName}
      joinUrl={joinUrl}
      qrDataUrl={qrDataUrl}
      onExit={onExit}
      onEnterGame={() => setScreen("GAME")}
    />
  )
}
