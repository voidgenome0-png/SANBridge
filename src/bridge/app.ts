import { app } from "electron"
import { getAppInfo } from "sanhelper.rs"
import { init } from "steamworks.js"
import { log } from "./log"
import { AchievementProgress, bridgePipe, UnlockEvent } from "./pipe"

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
const ACHIEVEMENT_POLL_MS = Math.max(
    100,
    Math.min(2000,Number(process.env.SANBRIDGE_POLL_MS) || 250)
)

app.disableHardwareAcceleration()
app.commandLine.appendSwitch("disable-gpu")
app.commandLine.appendSwitch("disable-extensions")
app.commandLine.appendSwitch("disable-background-networking")

let shuttingDown = false
let activeAppId = 0
let detectionTimer: NodeJS.Timeout | null = null
let achievementTimer: NodeJS.Timeout | null = null
let lifecycleTimer: NodeJS.Timeout | null = null
let gameMissingSince = 0

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
    if (achievementTimer) clearInterval(achievementTimer)
    if (lifecycleTimer) clearInterval(lifecycleTimer)
    detectionTimer = null
    achievementTimer = null
    lifecycleTimer = null
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
    let previous = snapshot(client,names)
    const initialProgress = progress(previous)

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

    let polling = false
    achievementTimer = setInterval(() => {
        if (polling || shuttingDown) return
        polling = true

        try {
            const current = snapshot(client,names)
            const newlyUnlocked = current.filter((achievement,index) =>
                achievement.unlocked && !previous[index]?.unlocked
            )

            if (newlyUnlocked.length) {
                const currentProgress = progress(current)
                const unlockTime = new Date().toISOString()

                for (const achievement of newlyUnlocked) {
                    const event: UnlockEvent = {
                        version: 1,
                        type: "achievement-unlocked",
                        source: "official-steam",
                        appId,
                        apiName: achievement.apiName,
                        displayName: achievement.displayName,
                        unlockTime,
                        eventId: `official-steam:${appId}:${achievement.apiName}:${unlockTime}`,
                        achievementProgress: currentProgress
                    }

                    log.info(
                        `achievement unlocked: "${achievement.displayName}" ` +
                        `(${currentProgress.unlocked}/${currentProgress.total}, ${currentProgress.percent}%)`
                    )

                    void bridgePipe.send(event).then(sent => {
                        if (sent) log.info(`achievement event sent to AW Next: ${achievement.apiName}`)
                    })
                }
            }

            previous = current
        } catch (error) {
            log.error(`achievement poll failed: ${error instanceof Error ? error.stack || error.message : error}`)
        } finally {
            polling = false
        }
    },ACHIEVEMENT_POLL_MS)
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
        `poll=${ACHIEVEMENT_POLL_MS}ms; log=${log.file}`
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
