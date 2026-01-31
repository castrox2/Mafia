import type { Server } from "socket.io";

export type PlayerId = string;
export type PlayerAliveStatus = boolean;
export type PlayerVoteCount = number;
export type PlayerRole = string;

export type PlayerRecord = {
    id: PlayerId;
    alive: PlayerAliveStatus;
    voteCount: PlayerVoteCount;
    role: PlayerRole;
}

type Room = {players: PlayerRecord[]};
type Rooms = Record<string, Room>;

// Clean roomid
const normalizeRoomId = (roomId: string): string => (roomId || "").trim().toUpperCase();

// Storage access
export const getPlayerById = (
    rooms: Rooms,
    roomId: string,
    playerId: PlayerId
): PlayerRecord | null => {
    const room = rooms[normalizeRoomId(roomId)];
    if (!room) return null;

    return room.players.find((p) => p.id === playerId) ?? null;
}

// Set/update player's status
export const setPlayerStatus = (
    rooms: Rooms,
    roomId: string,
    playerId: PlayerId, 
    alive: PlayerAliveStatus
): boolean => {
    const player = getPlayerById(rooms, roomId, playerId);
    if (!player) return false;
    player.alive = alive;
    return true;
}

// Set player's vote count
export const setPlayerVoteCount = (
    rooms: Rooms,
    roomId: string,
    playerId: PlayerId, 
    voteCount : PlayerVoteCount
): boolean => {
    const player = getPlayerById(rooms, roomId, playerId);
    if (!player) return false;

    player.voteCount = voteCount;
    return true;
}

// Increment player's vote count by 1
export const incrementPlayerVoteCount = (
    rooms: Rooms,
    roomId: string,
    playerId: PlayerId, 
): boolean => {
    const player = getPlayerById(rooms, roomId, playerId);
    if (!player) return false;

    player.voteCount++;
    return true;
}

// Set/update player role 
export const setPlayerRole = (
    rooms: Rooms,
    roomId: string,
    playerId: PlayerId, 
    role : PlayerRole,
): boolean => {
    const player = getPlayerById(rooms, roomId, playerId);
    if (!player) return false;
    player.role = role;
    return true;
}

// Randomize roles in lobby
export const randomizePlayerRoles = (
    rooms: Rooms,
    roomId: string,
): boolean => {
    const room = rooms[normalizeRoomId(roomId)];
    if (!room) return false;
    const playerCount = room.players.length
    if (playerCount === 0) return false;

    const mafiaMax = Math.floor(playerCount/4); 

    for (const player of room.players) {
        player.role = "villager";
    }

    for (let mafiaCount = 0; mafiaCount < mafiaMax ; mafiaCount++){
        const player = room.players[Math.floor(Math.random() * playerCount)]
        if (player.role === "villager") {
            player.role = "mafia";
        } else {
            mafiaCount--;
        }
    }

    return true;
}

// Test 
export const emitPlayerStatus = (io: Server, playerId: string, status: "alive" | "dead"): void => {
    io.emit("player:status", {playerId, status})
}