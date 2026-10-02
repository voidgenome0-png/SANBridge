import net from "net"
import { log } from "./log"

const PIPE_PATH = "\\\\.\\pipe\\AWNextSteamUnlocks"
const CONNECTION_TIMEOUT_MS = 1000
const MAX_EVENT_BYTES = 16 * 1024

const send = (payload: unknown): Promise<void> => {
    return new Promise(resolve => {
        let finished = false

        const finish = () => {
            if (finished) return
            finished = true
            resolve()
        }

        let message: string

        try {
            message = `${JSON.stringify(payload)}\n`
        } catch (err) {
            log.write(
                "ERROR",
                `[SANBridge] unable to serialize achievement event: ${err}`
            )
            return finish()
        }

        const messageBytes = Buffer.byteLength(message,"utf8")

        if (messageBytes > MAX_EVENT_BYTES) {
            log.write(
                "ERROR",
                `[SANBridge] achievement event exceeds ` +
                `${MAX_EVENT_BYTES}-byte limit`
            )
            return finish()
        }

        const socket = net.createConnection(PIPE_PATH)

        socket.setTimeout(CONNECTION_TIMEOUT_MS)

        socket.once("connect",() => {
            socket.end(message,() => {
                log.write(
                    "INFO",
                    `[SANBridge] achievement event sent to AW Next`
                )
                finish()
            })
        })

        socket.once("timeout",() => {
            log.write(
                "WARN",
                `[SANBridge] AW Next pipe connection timed out`
            )
            socket.destroy()
            finish()
        })

        socket.once("error",err => {
            log.write(
                "WARN",
                `[SANBridge] AW Next pipe unavailable: ${err.message}`
            )
            socket.destroy()
            finish()
        })

        socket.once("close",finish)
    })
}

export const sanbridgepipe = {
    path: PIPE_PATH,
    send
}