import * as QRCode from "qrcode"
import { encode } from "punycode"

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
const CODE_LENGTH = 5

export function generateRoomCode(
    existingRooms: Record<string, any>, 
): string { 

    let code = ""
    
    do {
        code = Array.from({ length: CODE_LENGTH }, () =>
            CHARS[Math.floor(Math.random() * CHARS.length)]).join("")
    } while (existingRooms[code])

    return code
}

export async function generateRoomJoinQrDataUrl(baseUrl: string, roomId: string): Promise<{ joinUrl: string; qrDataUrl: string }> {
  const cleanBaseUrl = (baseUrl || "").trim().replace(/\/+$/, "")
  const cleanRoomId = (roomId || "").trim().toUpperCase()

  const joinUrl = `${cleanBaseUrl}/?room=${encodeURIComponent(cleanRoomId)}`
  const qrDataUrl = await QRCode.toDataURL(joinUrl)

  return { joinUrl, qrDataUrl }
}