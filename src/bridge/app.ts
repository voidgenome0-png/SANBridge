import { app } from "electron"
import { getAppInfo } from "sanhelper.rs"
import { init } from "steamworks.js"
import { log } from "./log"
import { AchievementProgress, bridgePipe, ProgressEvent, UnlockEvent } from "./pipe"
import { classifyStoredAchievement } from "./storedAchievement"

type SteamAchievement = {
    apiName: string
    displayName: string
    unlocked: boolean
}

type SteamClient = ReturnType<typeof init>

const EXCLUDED_APP_IDS = new Set<number>([
    431960 // Wallpaper Engine
])

const DETECTION_INTERVAL_MS = 1000
const GAME_EXIT_GRACE_MS = 15000
app.disableHardwareAcceleration()
app.commandLine.appendSwitch("disable-gpu")
app.commandLine.appendSwitch("disable-extensions")
app.commandLine.appendSwitch("disable-background-networking")

let shuttingDown = false
let activeAppId = 0
let detectionTimer: NodeJS.Timeout | null = null
let lifecycleTimer: NodeJS.Timeout | null = null
let gameMissingSince = 0
let achievementCallback: { disconnect(): void } | null = null

const snapshot = (client: SteamClient,names: string[]): SteamAchievement[] => names.map(apiName => ({
    apiName,
    displayName: client.achievement.getAchievementDisplayAttribute(apiName,"name") || apiName,
    unlocked: client.achievement.isActivated(apiName)
}))

const progress = (achievements: SteamAchievement[]): AchievementProgress => {
    const total = achievements.length
    const unlocked = achievements.filter(achievement => achievement.unlocked).length
    return {
        unlocked,
        total,
        percent: total ? Math.round((unlocked / total) * 10000) / 100 : 0
    }
}

const stopTimers = (): void => {
    if (detectionTimer) clearInterval(detectionTimer)
    if (lifecycleTimer) clearInterval(lifecycleTimer)
    detectionTimer = null
    lifecycleTimer = null
    if (achievementCallback) achievementCallback.disconnect()
    achievementCallback = null
}

const fail = (error: unknown): void => {
    log.error(error instanceof Error ? error.stack || error.message : error)
    stopTimers()
    app.exit(1)
}

const startTracking = (appId: number,gameName: string): void => {
    activeAppId = appId
    log.info(`official Steam game detected: "${gameName}" (AppID ${appId})`)

    let client: SteamClient
    try {
        client = init(appId)
    } catch (error) {
        throw new Error(`Steamworks initialization failed for AppID ${appId}: ${error instanceof Error ? error.message : error}`)
    }

    const names = client.achievement.getAchievementNames()
    const initialProgress = progress(snapshot(client,names))
    const knownNames = new Set(names)
    const completedThisSession = new Set<string>()
    const lastProgress = new Map<string,string>()

    log.info(
        `tracking ${initialProgress.total} achievement(s); ` +
        `${initialProgress.unlocked} already unlocked (${initialProgress.percent}%)`
    )

    lifecycleTimer = setInterval(() => {
        try {
            const stillActive = getAppInfo().some(entry => entry.appid === appId)
            if (stillActive) {
                gameMissingSince = 0
                return
            }

            if (!gameMissingSince) {
                gameMissingSince = Date.now()
                return
            }

            if (Date.now() - gameMissingSince >= GAME_EXIT_GRACE_MS) {
                log.info(`official Steam game exited: AppID ${appId}`)
                app.quit()
            }
        } catch (error) {
            log.warn(`game-exit check failed: ${error instanceof Error ? error.message : error}`)
        }
    },DETECTION_INTERVAL_MS)

    achievementCallback = client.callback.registerUserAchievementStored(value => {
        if (shuttingDown) return
        try {
            const apiName = String(value.achievementName || "").trim()
            if (!apiName || !knownNames.has(apiName)) {
                log.warn(`UserAchievementStored_t ignored unknown achievement API name: ${apiName || "(empty)"}`)
                return
            }

            const update = classifyStoredAchievement(
                Number(value.currentProgress),
                Number(value.maxProgress)
            )
            const observedAt = new Date().toISOString()

            if (update.kind === "completion") {
                if (completedThisSession.has(apiName)) {
                    log.debug(`duplicate completion callback suppressed: ${apiName}`)
                    return
                }
                completedThisSession.add(apiName)

                const displayName = client.achievement.getAchievementDisplayAttribute(apiName,"name") || apiName
                const currentProgress = progress(snapshot(client,names))
                const event: UnlockEvent = {
                    version: 1,
                    type: "achievement-unlocked",
                    source: "official-steam",
                    appId,
                    apiName,
                    displayName,
                    unlockTime: observedAt,
                    eventId: `official-steam:${appId}:${apiName}:${observedAt}`,
                    achievementProgress: currentProgress
                }

                log.info(
                    `achievement completed: "${displayName}" ` +
                    `(${currentProgress.unlocked}/${currentProgress.total}, ${currentProgress.percent}%)`
                )
                void bridgePipe.send(event).then(sent => {
                    if (sent) log.info(`achievement event sent to AW Next: ${apiName}`)
                })
                return
            }

            const progressKey = `${update.current}/${update.max}`
            if (lastProgress.get(apiName) === progressKey) {
                log.debug(`duplicate progress callback suppressed: ${apiName} ${progressKey}`)
                return
            }
            lastProgress.set(apiName,progressKey)

            const event: ProgressEvent = {
                version: 1,
                type: "achievement-progress",
                source: "official-steam",
                appId,
                apiName,
                currentProgress: update.current,
                maxProgress: update.max,
                percent: update.percent,
                observedAt,
                eventId: `official-steam:${appId}:${apiName}:progress:${update.current}:${update.max}:${observedAt}`
            }

            log.info(`achievement progress: ${apiName} ${update.current}/${update.max} (${update.percent}%)`)
            void bridgePipe.send(event).then(sent => {
                if (sent) log.info(`progress event sent to AW Next: ${apiName}`)
            })
        } catch (error) {
            log.error(`UserAchievementStored_t handling failed: ${error instanceof Error ? error.stack || error.message : error}`)
        }
    })
}

const detectGame = (): void => {
    if (activeAppId || shuttingDown) return

    try {
        const game = getAppInfo().find(entry =>
            Number.isInteger(entry.appid) &&
            entry.appid > 0 &&
            !EXCLUDED_APP_IDS.has(entry.appid)
        )

        if (!game) return
        if (detectionTimer) clearInterval(detectionTimer)
        detectionTimer = null
        startTracking(game.appid,game.gamename || "Unknown")
    } catch (error) {
        log.error(`game detection failed: ${error instanceof Error ? error.stack || error.message : error}`)
    }
}

const shutdown = (reason: string): void => {
    if (shuttingDown) return
    shuttingDown = true
    log.info(`stopping: ${reason}`)
    stopTimers()
}

const main = (): void => {
    log.info(
        `headless bridge ready; pipe=${bridgePipe.path}; ` +
        `achievement-source=UserAchievementStored_t; log=${log.file}`
    )

    detectGame()
    detectionTimer = setInterval(detectGame,DETECTION_INTERVAL_MS)
}

if (!app.requestSingleInstanceLock()) {
    log.warn("another SANBridge instance is already running")
    app.exit(0)
} else {
    app.on("second-instance",() => log.debug("duplicate launch ignored"))
    app.on("before-quit",() => shutdown("application quit"))
    process.on("SIGINT",() => { shutdown("SIGINT"); app.quit() })
    process.on("SIGTERM",() => { shutdown("SIGTERM"); app.quit() })
    process.on("uncaughtException",fail)
    process.on("unhandledRejection",fail)

    void app.whenReady().then(main).catch(fail)
}
