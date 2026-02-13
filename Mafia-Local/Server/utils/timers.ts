import type { Server as SocketIOServer } from "socket.io"
import type {
  MafiaClientToServerEvents,
  MafiaPhase,
  MafiaServerToClientEvents,
  MafiaSocketData,
} from "../../Shared/events.js"

type MafiaIoServer = SocketIOServer<
  MafiaClientToServerEvents,
  MafiaServerToClientEvents,
  Record<string, never>,
  MafiaSocketData
>

export type PhaseName = MafiaPhase

export type TimerState = {
    roomId: string
    phase: PhaseName
    duration: number // in seconds
    startedAtMs: number
    endsAtMs: number
    secondsLeft: number
    running: boolean
}

type RoomTimers = {
    state:TimerState
    intervalId: NodeJS.Timeout
}

type OnTimerEnd = (args: { roomId: string; phase: PhaseName }) => void

export function createTimersManager(
    io: MafiaIoServer, 
    onTimerEnd: OnTimerEnd
) {
    const timers: Record<string, RoomTimers> = {}

    const getSecondsLeft = (endsAtMs: number): number => { // ": number" to anotate return type 
        return Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000))
    }

    const emitTimerState = (roomId: string) => {
        const t = timers[roomId]
        if (!t) return
        io.to(roomId).emit("timerState", t.state)
    }

    const clearTimer = (roomId: string) => {
        const t = timers[roomId]
        if (!t) return

        clearInterval(t.intervalId)
        delete timers[roomId]

        io.to(roomId).emit("timerCleared", { roomId })
    }

    const startTimer = (roomId: string, phase: PhaseName, duration: number) => {
        // Replace any existing timer for this room
        clearTimer(roomId)

        const startedAtMs = Date.now()
        const endsAtMs = startedAtMs + duration * 1000

        const state: TimerState = {
            roomId,
            phase,
            duration,
            startedAtMs,
            endsAtMs,
            secondsLeft: duration,
            running: true,
        }

        // Create interval tick
        const intervalId = setInterval(() => {
            const t = timers[roomId]
            if (!t) return

            const left = getSecondsLeft(t.state.endsAtMs)
            t.state.secondsLeft = left

            // Broadcast ticking state (every second)
            io.to(roomId).emit("timerTick", t.state)

            // End Condition
            if (left <= 0) {
                // Stop timer
                clearInterval(t.intervalId)
                delete timers[roomId]

                io.to(roomId).emit("timerEnded", { roomId, phase })

                onTimerEnd?.({ roomId, phase })
            }
        }, 1000)

        timers[roomId] = {
            state,
            intervalId
        }

        // Fire immediate state so clients don't have to wait 1s
        io.to(roomId).emit("timerStarted", state)
        emitTimerState(roomId)

        return state
    }

    const getTimer = (roomId: string): TimerState | null => {
        const t = timers[roomId]
        if (!t) return null

        // Refresh Seconds Left based on current time
        const left = getSecondsLeft(t.state.endsAtMs)
        return { ...t.state, secondsLeft: left }
    }

    // If you remove a room, also clear its timer
    const removeRoom = (roomId: string) => {
        clearTimer(roomId)
    }

    return {
        startTimer,
        clearTimer,
        getTimer,
        removeRoom,
    }
}
