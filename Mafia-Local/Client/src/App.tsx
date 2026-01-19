import React, { useState } from "react"
import Join from "../pages/Join.js"
import Lobby from "../pages/Lobby.js"

export default function App() {
  const [roomId, setRoomId] = useState("")
  const [playerName, setPlayerName] = useState("")

  const inLobby = !!roomId && !!playerName

  if (!inLobby) {
    return (
      <Join
        onEnterLobby={(newRoomId, name) => {
          setRoomId(newRoomId)
          setPlayerName(name)
        }}
      />
    )
  }

  return (
    <Lobby
      roomId={roomId}
      playerName={playerName}
      onExit={() => {
        setRoomId("")
        setPlayerName("")
        // Optional: clear URL query if QR brought you here
        window.history.replaceState({}, "", "/")
      }}
    />
  )
}
