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