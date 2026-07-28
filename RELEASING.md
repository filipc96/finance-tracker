# Releasing Fintrax (signed builds + auto-update)

Fintrax ships as a Windows NSIS installer built by `desktop/build.ps1`. The
desktop app checks for updates on launch via the Tauri updater plugin. This doc
covers cutting a **signed** release and publishing the update feed.

The plumbing (updater plugin, dialog, signing config, in-app check) is already
wired up in the code. What's left is **operational** and mostly one-time:

1. one-time: create the public releases repo and point the app at it,
2. every release: build with the signing key set, then upload the artifacts.

---

## 0. One-time setup

### 0.1 The signing keypair (already generated)

An updater signing keypair already exists on this machine:

- **Private key:** `%USERPROFILE%\.tauri\fintrax-updater.key`
- **Public key:** `%USERPROFILE%\.tauri\fintrax-updater.key.pub`
- **Passphrase:** stored in `%USERPROFILE%\.tauri\fintrax-updater.password`

The key is passphrase-protected. The passphrase lives in a plain file next to the
key so the build can read it non-interactively — move it into your password
manager and delete that file if you prefer, but then you must supply the
passphrase yourself at build time (see step 1.2). A **non-empty** passphrase is
required on Windows: `cargo tauri build` takes the passphrase only from the
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` env var, and Windows silently drops
**empty-valued** env vars before they reach a child process — so an empty
passphrase makes the signer fall back to an interactive prompt and the build
fails. Keep the passphrase non-empty.

The **public** key is embedded in `src-tauri/tauri.conf.json`
(`plugins.updater.pubkey`) and is safe to commit — it only lets clients *verify*
signatures. The **private** key and its passphrase must **never** be committed or
shared; anyone holding both can push a forged update to every install. Back them
up somewhere private (password manager / encrypted store). If either is lost,
existing installs can no longer auto-update to anything you sign with a new key —
they'd need a manual reinstall — so keep them safe.

To regenerate from scratch (only if the key is lost/compromised):

```powershell
cargo tauri signer generate -p "<non-empty-passphrase>" -w "$env:USERPROFILE\.tauri\fintrax-updater.key" -f
```

Then paste the new public key into `plugins.updater.pubkey` in
`src-tauri/tauri.conf.json` and ship a build with it before the old installs can
update again.

### 0.2 The releases repo / update endpoint

`src-tauri/tauri.conf.json` → `plugins.updater.endpoints` currently points at a
**placeholder**:

```
https://github.com/CHANGE-ME/fintrax-releases/releases/latest/download/latest.json
```

Replace `CHANGE-ME/fintrax-releases` with the real GitHub repo that will host
releases, e.g. `yourname/fintrax-releases`. Notes:

- The repo can be under your personal account or an org.
- **The repo must be public** — the updater fetches `latest.json` and the
  installer over plain HTTPS with no auth. Your **source** repo can stay private;
  this is a *separate* repo that only holds published release assets. (If you'd
  rather keep everything private, you'd need a self-hosted endpoint that serves
  the JSON + installer with auth baked into the URL — out of scope here.)
- `releases/latest/download/<asset>` always resolves to the newest GitHub
  Release's asset, so the endpoint URL never changes between versions.

After editing the endpoint, rebuild so the change is baked into the installer.

---

## 1. Per-release steps

### 1.1 Bump the version

The updater compares the running app's version against the version in
`latest.json`. Bump the version in **all** of these so they agree:

- `src-tauri/tauri.conf.json` → `version`
- `src-tauri/Cargo.toml` → `package.version`
- `frontend/package.json` → `version` (cosmetic, keep in sync)

Use semver (e.g. `1.0.0` → `1.0.1`). An install only offers the update when the
feed's version is **higher** than what's running.

### 1.2 Build with the signing key set

`cargo tauri build` (invoked by `build.ps1`) produces signed updater artifacts
**only when the signing env vars are present**. Set them for the build session,
then run the normal build script:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\fintrax-updater.key" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = Get-Content "$env:USERPROFILE\.tauri\fintrax-updater.password" -Raw

# Full build (frontend + sidecar + Tauri/NSIS). Run from the repo root with
# Windows PowerShell (powershell.exe); `pwsh` may not be installed:
.\desktop\build.ps1
```

> `TAURI_SIGNING_PRIVATE_KEY` takes the **contents** of the key file, not its
> path. The `Get-Content -Raw` calls above read both files for you.
>
> Do **not** set the passphrase to `""` — on Windows an empty env var never
> reaches `cargo tauri build`, which then prompts and fails the build. If you
> moved the passphrase into a password manager, type it instead:
> `$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = 'your-passphrase'`.

Because `createUpdaterArtifacts: true` is set in `tauri.conf.json`, a signed
build emits two extra files next to the installer in
`src-tauri\target\release\bundle\nsis\`:

- `Fintrax_<version>_x64-setup.exe` — the installer (the update payload)
- `Fintrax_<version>_x64-setup.exe.sig` — its detached minisign signature

If the `.sig` file is **missing**, the env vars weren't set — the build silently
produces an unsigned installer that the updater will reject. Re-check step 1.2.

### 1.3 Publish the GitHub Release

Create a new Release in the **public releases repo** (tag = the new version, e.g.
`v1.0.1`) and upload:

1. `Fintrax_<version>_x64-setup.exe`
2. `Fintrax_<version>_x64-setup.exe.sig`
3. `latest.json` (the update manifest — see below)

### 1.4 Write `latest.json`

The updater fetches this file and compares its `version`. Minimal Windows-only
manifest:

```json
{
  "version": "1.0.1",
  "notes": "What changed in this release.",
  "pub_date": "2026-07-25T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<paste the FULL contents of the .sig file here>",
      "url": "https://github.com/<you>/fintrax-releases/releases/download/v1.0.1/Fintrax_1.0.1_x64-setup.exe"
    }
  }
}
```

- `signature` is the **entire text** of the `.sig` file, pasted inline (not a
  URL, not a path).
- `url` points at the installer asset uploaded in step 1.3.
- `version` must exactly match `tauri.conf.json` for that build and be higher
  than the previously shipped version.

Because the endpoint uses `releases/latest/download/latest.json`, uploading this
file to the newest Release automatically makes it the served manifest.

---

## 2. How the client update flow works

On launch, after the backend is healthy and the main window opens,
`spawn_update_check` (in `src-tauri/src/lib.rs`) runs on a background thread:

1. fetches `latest.json` from the endpoint,
2. if its `version` is newer, verifies the installer's signature against the
   embedded public key,
3. shows a native **"Update available"** dialog (Install / Later),
4. on **Install**, downloads + runs the NSIS installer, then restarts the app.

Every step fails **silently** (logged to stderr, no error popup) when the feed is
unreachable — so before the releases repo is live, or when a user is offline, the
app just starts normally with no nagging.

---

## 3. Quick checklist

- [ ] `plugins.updater.endpoints` points at the real public releases repo (one-time)
- [ ] version bumped in `tauri.conf.json`, `Cargo.toml`, `frontend/package.json`
- [ ] `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` set in the shell
- [ ] `build.ps1` run; `.exe` **and** `.exe.sig` present in the NSIS bundle dir
- [ ] GitHub Release created; installer, `.sig`, and `latest.json` uploaded
- [ ] `latest.json` `version`/`url`/`signature` correct
- [ ] private key backed up, never committed
