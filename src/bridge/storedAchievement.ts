export type StoredAchievementCompletion = {
    kind: "completion"
}

export type StoredAchievementProgress = {
    kind: "progress"
    current: number
    max: number
    percent: number
}

export type StoredAchievementUpdate = StoredAchievementCompletion | StoredAchievementProgress

export const classifyStoredAchievement = (
    currentProgress: number,
    maxProgress: number
): StoredAchievementUpdate => {
    if (!Number.isSafeInteger(currentProgress) || currentProgress < 0) {
        throw new Error("UserAchievementStored_t current progress is invalid")
    }
    if (!Number.isSafeInteger(maxProgress) || maxProgress < 0) {
        throw new Error("UserAchievementStored_t maximum progress is invalid")
    }

    // Steam documents 0/0 as the completion form of UserAchievementStored_t.
    // It must never become a false 0% progress notification.
    if (currentProgress === 0 && maxProgress === 0) return { kind: "completion" }
    if (maxProgress === 0) {
        throw new Error("UserAchievementStored_t progress update has a zero maximum")
    }

    return {
        kind: "progress",
        current: currentProgress,
        max: maxProgress,
        percent: Math.round((Math.min(currentProgress,maxProgress) / maxProgress) * 10000) / 100
    }
}

