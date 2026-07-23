# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the Fintrax desktop sidecar (onefile).

Bundles Django + the built React SPA into a single exe. Consumed by the
Tauri launcher as `bundle.externalBin`. Build from the backend dir:

    .venv/Scripts/pyinstaller fintrax-server.spec

Output: dist/fintrax-server.exe
"""

from pathlib import Path

from PyInstaller.utils.hooks import (
    collect_all,
    collect_data_files,
    collect_submodules,
)

SPEC_DIR = Path(SPECPATH)
FRONTEND_DIST = SPEC_DIR.parent / "frontend" / "dist"

# --- data files -----------------------------------------------------------
# The SPA is unpacked to <_MEIPASS>/frontend/dist, matching settings.py's
# _frontend_dist_dir() (falls back to sys._MEIPASS at runtime).
datas = [(str(FRONTEND_DIST), "frontend/dist")]
datas += collect_data_files("rest_framework")   # DRF browsable-API templates/static
datas += collect_data_files("django")           # admin templates/static, i18n
datas += collect_data_files("whitenoise")

# --- hidden imports --------------------------------------------------------
# Django loads apps, migrations, and DB/template backends by string name, so
# PyInstaller's static analysis misses them.
hiddenimports = []
hiddenimports += collect_submodules("api")
hiddenimports += collect_submodules("rest_framework")
hiddenimports += collect_submodules("rest_framework_simplejwt")
hiddenimports += collect_submodules("corsheaders")
hiddenimports += collect_submodules("whitenoise")
hiddenimports += [
    "waitress",
    "dotenv",
    "requests",
    "dateutil",
    "sqlite3",
    "django.contrib.staticfiles.storage",
    "django.core.management.commands.migrate",
    "django.core.management.commands.collectstatic",
    "django.db.backends.sqlite3",
    "django.template.backends.django",
]

# --- heavy third-party SDKs (pydantic / httpx / distro under the hood) -----
binaries = []
for pkg in ("openai", "anthropic"):
    pkg_datas, pkg_binaries, pkg_hidden = collect_all(pkg)
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hidden


a = Analysis(
    ["desktop.py"],
    pathex=[str(SPEC_DIR)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "psycopg2", "psycopg2-binary"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="fintrax-server",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
