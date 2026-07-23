"""Desktop entrypoint — the PyInstaller sidecar spawned by the Tauri app.

Prepares a per-user data directory, applies migrations, collects static
assets, then serves Django (API + the bundled React app) via waitress on
127.0.0.1. The Tauri launcher passes --port and --data-dir and waits for
the /health/ endpoint before showing its window.
"""

import argparse
import os
import sys


def main():
    parser = argparse.ArgumentParser(description="Fintrax desktop server")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--data-dir", required=True)
    args = parser.parse_args()

    os.makedirs(args.data_dir, exist_ok=True)
    os.environ["FINTRAX_DATA_DIR"] = args.data_dir
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

    import django
    from django.core.management import call_command

    django.setup()

    # Bring the per-user database up to date and gather admin/DRF static
    # assets into the data dir (the SPA itself is served from the bundle).
    call_command("migrate", "--noinput")
    call_command("collectstatic", "--noinput", verbosity=0)

    from waitress import serve
    from backend.wsgi import application

    # Printed before serve() (which blocks) so the launcher can also detect
    # readiness from stdout, in addition to polling /health/.
    print(f"FINTRAX READY on {args.port}", flush=True)
    serve(application, host="127.0.0.1", port=args.port, threads=8)


if __name__ == "__main__":
    main()
