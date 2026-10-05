# Apply SANBridge V2 to the fork

The archive is an overlay for commit `57a0b8b` on
`sanbridge-headless-v1`.

```powershell
git switch sanbridge-headless-v1
git pull --ff-only
git switch -c sanbridge-headless-v2
```

Extract the archive into the repository root and allow it to overwrite the
listed files. Then run:

```powershell
npm ci
npm run build
npm run win:portable
```

The portable output is `_release\win-unpacked`.

After the build succeeds, you may remove the legacy source/assets listed in
`SAFE_DELETE_V2.md`. Those deletions reduce the repository and source archive;
the V2 portable build already excludes them even if you leave them in place.

Commit and publish the branch:

```powershell
git add -A
git commit -m "Create lean headless SANBridge V2"
git push -u origin sanbridge-headless-v2
```

Replace the existing bundled SANBridge folder in Achievement Watcher Next with
the contents of the newly built `win-unpacked` folder. Keep the executable name
`Steam Achievement Notifier (V1.9).exe`, because the current watchdog searches
for that filename.
