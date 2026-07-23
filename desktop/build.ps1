<#
.SYNOPSIS
    Build the Fintrax Windows desktop app (Tauri 2 + Django sidecar).

.DESCRIPTION
    Runs the full packaging pipeline:
      1. Build the React SPA            -> frontend/dist
      2. PyInstaller the Django sidecar -> backend/dist/fintrax-server.exe
      3. Copy the sidecar with the Rust host-triple suffix into src-tauri/binaries
      4. cargo tauri build              -> NSIS installer in src-tauri/target/release/bundle/nsis

    Run from anywhere; paths are resolved relative to the repo root.
    Requires: Node/npm, the backend venv with requirements-desktop.txt installed,
    Rust + cargo, and the Tauri CLI (cargo install tauri-cli --version "^2").
#>
[CmdletBinding()]
param(
    # Skip the frontend build (use the existing frontend/dist).
    [switch]$SkipFrontend,
    # Skip the PyInstaller build (reuse backend/dist/fintrax-server.exe).
    [switch]$SkipSidecar
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Frontend = Join-Path $RepoRoot "frontend"
$Backend  = Join-Path $RepoRoot "backend"
$SrcTauri = Join-Path $RepoRoot "src-tauri"
$Venv     = Join-Path $Backend ".venv\Scripts"

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

# 1. Frontend -------------------------------------------------------------
if (-not $SkipFrontend) {
    Step "Building React SPA"
    Push-Location $Frontend
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
    Pop-Location
}

# 2. Sidecar --------------------------------------------------------------
if (-not $SkipSidecar) {
    Step "Building Django sidecar (PyInstaller)"
    Push-Location $Backend
    & "$Venv\pyinstaller.exe" fintrax-server.spec --noconfirm
    if ($LASTEXITCODE -ne 0) { throw "pyinstaller failed" }
    Pop-Location
}

# 3. Stage the sidecar with the host-triple suffix Tauri expects ----------
Step "Staging sidecar binary"
$Triple = (rustc --print host-tuple).Trim()      # e.g. x86_64-pc-windows-msvc
$BinDir = Join-Path $SrcTauri "binaries"
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
$Src = Join-Path $Backend "dist\fintrax-server.exe"
$Dst = Join-Path $BinDir "fintrax-server-$Triple.exe"
Copy-Item $Src $Dst -Force
Write-Host "  -> $Dst"

# 4. Tauri build ----------------------------------------------------------
Step "Building Tauri app + NSIS installer"
Push-Location $SrcTauri
cargo tauri build
if ($LASTEXITCODE -ne 0) { throw "cargo tauri build failed" }
Pop-Location

$Nsis = Join-Path $SrcTauri "target\release\bundle\nsis"
Step "Done"
Write-Host "Installer(s):" -ForegroundColor Green
Get-ChildItem $Nsis -Filter *.exe | ForEach-Object { Write-Host "  $($_.FullName)" }
