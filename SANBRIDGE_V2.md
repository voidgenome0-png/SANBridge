# SANBridge V2

SANBridge V2 is a Windows-only, headless bridge for official Steam achievement
unlocks. It has no SAN user interface, tray icon, notification window, sound,
screenshot, updater, webhook, RetroAchievements worker, or stats-overlay window.

The executable detects the active official Steam AppID independently, polls its
achievement state, and writes newline-delimited JSON events to:

`\\.\pipe\AWNextSteamUnlocks`

All bridge logs are appended to:

`%APPDATA%\Achievement Watcher Next\logs\san.log`

## Build

Run the **Build SANBridge V2** GitHub Actions workflow, or run this on Windows:

```powershell
npm ci
npm run win:portable
```

The portable folder is `_release\win-unpacked`.

## Runtime options

- `SANBRIDGE_POLL_MS`: achievement poll interval, clamped to 100–2000 ms;
  default `250`.
- `SANBRIDGE_CALLBACK_HZ`: Steam callback rate, clamped to 1–30 Hz; default
  `10`.

The bridge excludes Wallpaper Engine (Steam AppID `431960`).
If AW Next does not terminate it first, V2 exits itself after the tracked Steam
AppID has been absent for 15 seconds.

## Progress data

SAN does not expose a Steam numeric stat-counter API. V2 therefore forwards
the progress SAN actually tracks: unlocked achievements versus total
achievements. Every `achievement-unlocked` event contains:

```json
"achievementProgress": {
  "unlocked": 12,
  "total": 52,
  "percent": 23.08
}
```

These extra fields are backward-compatible with the existing AW Next receiver.
They are not per-achievement counters such as `37/100 kills`.
