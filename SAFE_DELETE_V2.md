# Files safe to remove for the V2 Windows-only branch

The V2 compiler reads only `src/bridge`, and the portable package includes only
`dist/bridge` plus the two required native modules. The following legacy SAN
content is therefore not used by the V2 executable and may be deleted from the
V2 branch after preserving the V1 branch:

## Entire directories

- `fonts/`
- `icon/`
- `notify/`
- `sound/`
- `src/app/`
- `src/lang/`
- `src/notify/`
- `dist/app/`
- `deps/sanwatcher.rs/`
- `deps/HackTimer.min.js`
- `patches/`

## Individual files

- `afterpack.js`
- `beta.json`
- `tsconfig.json`
- `src/san.d.ts`
- `DEV.md`
- `KNOWNISSUES.md`
- `RA.md`

## `img/`

Keep only `img/sanlogo.ico` because electron-builder uses it for the Windows
executable. Every other image is unused by the V2 runtime and package.

## Required; do not delete

- `src/bridge/`
- `tsconfig.bridge.json`
- `package.json`
- `package-lock.json`
- `.github/workflows/build-baseline.yml`
- `afterpack-bridge.js`
- `deps/steamworks.js/index.js`
- `deps/steamworks.js/client.d.ts`
- `deps/steamworks.js/index.d.ts`
- `deps/steamworks.js/package.json`
- `deps/steamworks.js/dist/win64/`
- `deps/sanhelper.rs/index.js`
- `deps/sanhelper.rs/index.d.ts`
- `deps/sanhelper.rs/package.json`
- `deps/sanhelper.rs/sanhelperrs.win32-x64-msvc.node`
- `img/sanlogo.ico`

Within `deps/steamworks.js/dist/win64/`, the build needs the `.dll` and `.node`
files but excludes the developer-only `steam_api64.lib` import library.

Do not manually delete Electron runtime files from the generated
`win-unpacked` folder. Chromium/Electron loads several of them dynamically,
and a successful startup does not prove every delayed code path remains safe.
