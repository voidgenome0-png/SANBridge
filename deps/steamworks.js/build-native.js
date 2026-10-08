const path = require("node:path")
const { spawnSync } = require("node:child_process")

// SANBridge UserAchievementStored native build V3.
// @napi-rs/cli 2.16.2 joins the output directory to process.cwd() while writing
// declarations, so this must stay relative or Windows produces cwd + D:\...\cwd.
const windows = process.platform === "win32"
const target = windows ? "x86_64-pc-windows-msvc" : "x86_64-unknown-linux-gnu"
const output = path.join("dist",windows ? "win64" : "linux64")
const napi = path.join(__dirname,"node_modules","@napi-rs","cli","scripts","index.js")

const result = spawnSync(
    process.execPath,
    [
        napi,
        "build",
        "--platform",
        "--release",
        "--target",target,
        "--no-dts-header",
        "--js","false",
        "--dts","../../client.d.ts",
        output
    ],
    { cwd: __dirname, stdio: "inherit" }
)

if (result.error) throw result.error
process.exit(result.status == null ? 1 : result.status)

