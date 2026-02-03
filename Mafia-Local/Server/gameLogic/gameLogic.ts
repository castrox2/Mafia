import type { Server } from "socket.io";
import type { Player, PlayerRole } from "../players.js";


type Room = {players: Player[]};
type Rooms = Record<string, Room>;

// Clean roomid
const normalizeRoomId = (roomId: string): string => (roomId || "").trim().toUpperCase();

// Storage access
export const getPlayerById = (
    rooms: Rooms,
    roomId: string,
    playerId: string
): Player | null => {
    const room = rooms[normalizeRoomId(roomId)];
    if (!room) return null;

    return room.players.find((p) => p.id === playerId) ?? null;
}

// Set/update player's status
export const setPlayerStatus = (
    rooms: Rooms,
    roomId: string,
    playerId: string, 
    alive: boolean
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
    playerId: string, 
    voteCount : number
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
    playerId: string, 
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
    playerId: string, 
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

    for (let mafiaCount = 0; mafiaCount < mafiaMax ; mafiaCount++){
        const player = room.players[Math.floor(Math.random() * playerCount)]
        if (!player) return false;
        if (player.role === "CIVILIAN") {
            player.role = "MAFIA";
        } else {
            mafiaCount--;
        }
    }

    return true;
}

// Count and register vote
export const countPlayerVotes = (
  rooms: Rooms,
  roomId: string,
): boolean => {
  const room = rooms[normalizeRoomId(roomId)]
  if (!room) return false

  const playerCount = room.players.length
  if (playerCount === 0) return false

  const votedPlayers: Player[] = []
  let mostVotes = 0

  for (const player of room.players) {
    if (votedPlayers.length === 0) {
      votedPlayers.push(player)
      mostVotes = player.voteCount
    } else if (player.voteCount > mostVotes) {
      votedPlayers.length = 0
      votedPlayers.push(player)
      mostVotes = player.voteCount
    } else if (player.voteCount === mostVotes) {
      votedPlayers.push(player)
    }
  }

  // Tie: currently no one dies (WIP)
  if (votedPlayers.length > 1) {
    return false
  }

  // No winner found (edge case)
  const top = votedPlayers[0]
  if (!top) return false

  const target = getPlayerById(rooms, roomId, top.id)
  if (!target) return false

  target.alive = false
  return true
}
