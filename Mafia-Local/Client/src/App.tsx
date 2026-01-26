import React, { useState } from "react"
import Join from "../pages/Join.js"
import Lobby from "../pages/Lobby.js"

export default function App() {
  const [roomId, setRoomId] = useState("")
  const [playerName, setPlayerName] = useState("")
  const [joinUrl, setJoinUrl] = useState("")
  const [qrDataUrl, setQrDataUrl] = useState("")

  const inLobby = !!roomId && !!playerName

  if (!inLobby) {
    return (
      <Join
        onEnterLobby={(newRoomId, name, joinUrl, qrDataUrl) => {
          setRoomId(newRoomId)
          setPlayerName(name)
          setJoinUrl(joinUrl)
          setQrDataUrl(qrDataUrl)
        }}
      />
    )
  }

  return (
    <Lobby
      roomId={roomId}
      playerName={playerName}
      joinUrl={joinUrl}
      qrDataUrl={qrDataUrl}
      onExit={() => {
        setRoomId("")
        setPlayerName("")
        setJoinUrl("")
        setQrDataUrl("")
        // Optional: clear URL query if QR brought you here
        window.history.replaceState({}, "", "/")
      }}
    />
  )
}
