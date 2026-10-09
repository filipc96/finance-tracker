# Fintrax Desktop (Tauri 2) — Build & Architecture

Fintrax runs two ways from one codebase:

- **Web / dev** — `manage.py runserver` + `npm run dev`, exactly as before. No
  desktop code runs; everything below is gated on the `FINTRAX_DATA_DIR` env var,
  which only the desktop launcher sets.
- **Desktop** — a Tauri 2 window that loads a bundled Django server (the
  *sidecar*), which serves both the API and the built React app on one local
  port.

## How the desktop app works

```
Tauri (Rust)  ──spawns──▶  fintrax-server.exe  (PyInstaller onefile)
   │                          │  waitress ▸ Django
   │  polls /health/          │  • /api/*      → DRF
   │                          │  • /           → React SPA (WhiteNoise)
   └── opens window ─────────▶ http://127.0.0.1:8765/
```

- **Same origin**: Django serves the SPA and the API on one port, so there's no
  CORS and the JWT/theme in `localStorage` persist per origin.
- **Fixed port 8765**: keeps the origin stable across launches (so you stay
  logged in). If 8765 is taken, the launcher falls back to a free port — the
  cost is a one-time re-login for that session.
- **Per-user data** lives under `%APPDATA%\com.fintrax.app\`:
  `db.sqlite3`, `secret_key.txt` (generated on first run), `staticfiles/`.
- **Kill-on-exit**: the launcher terminates the sidecar when the window closes.

## Prerequisites

- Node + npm (frontend build)
- Rust + cargo, and the Tauri CLI: `cargo install tauri-cli --version "^2" --locked`
- Backend venv with desktop deps:
  `backend/.venv/Scripts/pip install -r backend/requirements-desktop.txt`
  (adds whitenoise, waitress, pyinstaller on top of `requirements.txt`)

## Build (one command)

```powershell
pwsh desktop/build.ps1
```

This runs the pipeline below and prints the installer path. Flags:
`-SkipFrontend` / `-SkipSidecar` to reuse existing `frontend/dist` /
`backend/dist/fintrax-server.exe` during iteration.

### Pipeline (what the script does)

1. `cd frontend && npm run build` → `frontend/dist`
   (production mode; `.env.production` sets `VITE_API_URL=` so API calls are relative)
2. `cd backend && .venv/Scripts/pyinstaller fintrax-server.spec` →
   `backend/dist/fintrax-server.exe` (bundles Django + `frontend/dist`)
3. Copy → `src-tauri/binaries/fintrax-server-<host-triple>.exe`
   (triple from `rustc --print host-tuple`, e.g. `x86_64-pc-windows-msvc`)
4. `cd src-tauri && cargo tauri build` → NSIS installer in
   `src-tauri/target/release/bundle/nsis/`

## Dev / debug loop

- **Iterate on the app UI**: keep using the web dev servers
  (`runserver` + `npm run dev`) — fastest, no packaging.
- **Test the desktop shell**: run steps 1–3 once, then
  `cd src-tauri && cargo tauri dev`. Rebuild the sidecar (step 2) only when the
  backend changes.
- **Test the sidecar alone** (no Tauri):
  ```powershell
  backend\dist\fintrax-server.exe --port 8766 --data-dir $env:TEMP\fintrax-test
  ```
  then open <http://127.0.0.1:8766/> — full app, deep-link reloads, and the API
  should all work.

## Notes / known limits

- **Onefile cold start** (~2–4 s temp-extract) is hidden behind the splash +
  `/health/` poll. Switch to onedir + Tauri `resources` later if it annoys.
- **Unsigned** exe + installer → Windows SmartScreen may warn. Code signing is
  out of scope.
- **Secrets** (OpenAI/Anthropic/T212 API keys) are vault-encrypted when the
  vault is locked, per the `vault.py` envelope-encryption design. They are
  decrypted in process memory while the vault is unlocked and the app is
  running. This is a deliberate trade-off: the sidecar poller needs access to
  the Telegram token at boot, before any vault unlock, so that one value is
  stored alongside the database (see the Telegram-access security notes in
  the README for the reasoning). The `desktop.py` launcher and the embedded
  waitress server enforce a per-user data directory (`FINTRAX_DATA_DIR`).
- **`.spec` and `binaries/*.exe` are build artifacts.** The `.spec` is committed
  (force-added past the Python gitignore); the sidecar exe and `frontend/dist`
  are regenerated and git-ignored.
