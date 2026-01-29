import React, { useEffect, useState } from "react"
import Join from "../pages/Join.js"
import Lobby from "../pages/Lobby.js"
import { onReconnected } from "./socket.js"

export default function App() {
  const [roomId, setRoomId] = useState("")
  const [playerName, setPlayerName] = useState("")
  const [joinUrl, setJoinUrl] = useState("")
  const [qrDataUrl, setQrDataUrl] = useState("")

  useEffect(() => {
    // Subscribe via buffered handler so we can't miss the event
    return onReconnected(({ roomId, playerName }) => {
      setRoomId(roomId)
      setPlayerName(playerName)
    })
  }, [])

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
