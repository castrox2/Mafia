import * as QRCode from "qrcode"
import { encode } from "punycode"

export function generateRoomCode(
    rooms: Record<string, unknown>,
    length: number = 4
): string { 
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"

    const generateCode = () => {
        let code = ""
        for (let i = 0; i < length; i++) {
            code += characters[Math.floor(Math.random() * characters.length)]
        }
        return code
    }
    
    // Try a few times at current length, then increase length if collisions happen
    let tries = 0
    let code = generateCode()

    while (rooms[code] && tries < 50) {
        code = generateCode()
        tries++
    }

    if (rooms[code]) {
        return generateRoomCode(rooms, length + 1)
    }

    return code
}


export async function generateRoomJoinQrDataUrl(
  baseUrl: string,
  roomId: string
): Promise<{ joinUrl: string; qrDataUrl: string }> {
  const cleanBase = baseUrl.replace(/\/+$/, "") // remove trailing slashes
  const joinUrl = `${cleanBase}/?room=${encodeURIComponent(roomId)}`

  const qrDataUrl = await QRCode.toDataURL(joinUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 6,
  })

  return { joinUrl, qrDataUrl }
}