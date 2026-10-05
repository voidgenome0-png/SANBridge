import fs from "fs"
import path from "path"

type Level = "DEBUG" | "INFO" | "WARN" | "ERROR"

const logDirectory = path.join(
    process.env.APPDATA || process.cwd(),
    "Achievement Watcher Next",
    "logs"
)

const logFile = path.join(logDirectory,"san.log")

const clean = (value: unknown): string => String(value ?? "")
    .replace(/\0/g,"")
    .replace(/\r?\n/g," ")
    .trim()

const write = (level: Level,message: unknown): void => {
    const line = `[${new Date().toISOString()}] [SANBridge/V2] [${level}] ${clean(message)}\n`

    try {
        fs.mkdirSync(logDirectory,{ recursive: true })
        fs.appendFileSync(logFile,line,"utf8")
    } catch {}

    if (level === "ERROR") return console.error(line.trimEnd())
    if (level === "WARN") return console.warn(line.trimEnd())
    console.log(line.trimEnd())
}

export const log = {
    file: logFile,
    debug: (message: unknown) => write("DEBUG",message),
    info: (message: unknown) => write("INFO",message),
    warn: (message: unknown) => write("WARN",message),
    error: (message: unknown) => write("ERROR",message)
}
