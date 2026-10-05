const fs = require("fs")
const path = require("path")

exports.default = async context => {
    if (context.electronPlatformName !== "win32") return

    const { appOutDir, packager } = context
    const productExe = path.join(
        appOutDir,
        `${packager.appInfo.productFilename}.exe`
    )
    const unbrandedExe = path.join(appOutDir,"electron.exe")

    // Some cross-platform directory builds can leave the original Electron
    // executable beside the renamed product executable. It is a duplicate and
    // is never launched by SANBridge.
    if (fs.existsSync(productExe) && fs.existsSync(unbrandedExe)) {
        fs.rmSync(unbrandedExe,{ force: true })
    }

    // SANBridge has no UI text. Keep Chromium's required fallback locale and
    // remove the other locale packs from the portable directory.
    const locales = path.join(appOutDir,"locales")
    if (fs.existsSync(locales)) {
        for (const file of fs.readdirSync(locales)) {
            if (file.toLowerCase() === "en-us.pak") continue
            fs.rmSync(path.join(locales,file),{ force: true })
        }
    }
}
