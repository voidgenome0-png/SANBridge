import net from "net"
import { log } from "./log"

const PIPE_PATH = "\\\\.\\pipe\\AWNextSteamUnlocks"
const CONNECTION_TIMEOUT_MS = 1000
const MAX_EVENT_BYTES = 16 * 1024

export type AchievementProgress = {
    unlocked: number
    total: number
    percent: number
}

export type UnlockEvent = {
    version: 1
    type: "achievement-unlocked"
    source: "official-steam"
    appId: number
    apiName: string
    displayName: string
    unlockTime: string
    eventId: string
    achievementProgress: AchievementProgress
}

const send = (payload: UnlockEvent): Promise<boolean> => new Promise(resolve => {
    let settled = false
    const finish = (value: boolean) => {
        if (settled) return
        settled = true
        resolve(value)
    }

    const message = `${JSON.stringify(payload)}\n`
    if (Buffer.byteLength(message,"utf8") > MAX_EVENT_BYTES) {
        log.error(`pipe event exceeds ${MAX_EVENT_BYTES}-byte limit`)
        return finish(false)
    }

    const socket = net.createConnection(PIPE_PATH)
    socket.setTimeout(CONNECTION_TIMEOUT_MS)

    socket.once("connect",() => socket.end(message,() => finish(true)))
    socket.once("timeout",() => {
        log.warn("AW Next pipe connection timed out")
        socket.destroy()
        finish(false)
    })
    socket.once("error",err => {
        log.warn(`AW Next pipe unavailable: ${err.message}`)
        socket.destroy()
        finish(false)
    })
    socket.once("close",() => finish(false))
})

export const bridgePipe = { path: PIPE_PATH, send }
