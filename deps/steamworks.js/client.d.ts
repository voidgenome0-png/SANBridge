export function init(appId?: number | undefined | null): void
export function runCallbacks(): void
export namespace achievement {
  export function isActivated(achievement: string): boolean
  export function getAchievementDisplayAttribute(achievement: string, key: string): string
  export function getAchievementNames(): Array<string>
}
export namespace callback {
  export interface UserAchievementStoredPayload {
    gameId: string
    achievementName: string
    currentProgress: number
    maxProgress: number
  }
  export class Handle {
    disconnect(): void
  }
  export function registerUserAchievementStored(handler: (value: UserAchievementStoredPayload) => void): Handle
}
