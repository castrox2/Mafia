import * as QRCode from "qrcode"
import {
  ROOM_CODE_CHARSET,
  ROOM_CODE_LENGTH,
  normalizeRoomId,
} from "../../Shared/events.js"

export function generateRoomCode(
  existingRooms: Record<string, unknown>,
): string { 
  let code = ""
  
  do {
    code = Array.from({ length: ROOM_CODE_LENGTH }, () =>
      ROOM_CODE_CHARSET[Math.floor(Math.random() * ROOM_CODE_CHARSET.length)]
    ).join("")
  } while (existingRooms[code])

  return code
}

export async function generateRoomJoinQrDataUrl(baseUrl: string, roomId: string): Promise<{ joinUrl: string; qrDataUrl: string }> {
  const cleanBaseUrl = (baseUrl || "").trim().replace(/\/+$/, "")
  const cleanRoomId = normalizeRoomId(roomId)

  const joinUrl = `${cleanBaseUrl}/?room=${encodeURIComponent(cleanRoomId)}`
  const qrDataUrl = await QRCode.toDataURL(joinUrl)

  return { joinUrl, qrDataUrl }
}
