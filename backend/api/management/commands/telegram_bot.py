"""Run the Telegram bot poller in the foreground (dev/test convenience).

The desktop sidecar starts the bot automatically as a daemon thread
(see backend/desktop.py). This command runs the same supervisor loop in the
foreground against the dev database, so you can test the bot with
`manage.py runserver` without building the packaged app:

    python manage.py telegram_bot

Configure the token / allowed id / enabled flag in the Settings page (or admin)
first. Ctrl-C to stop.
"""

from django.core.management.base import BaseCommand

from api.telegram_bot import run_supervisor


class Command(BaseCommand):
    help = "Run the Telegram remote-control bot poller in the foreground."

    def handle(self, *args, **options):
        self.stdout.write("Starting Telegram bot poller (Ctrl-C to stop)...")
        try:
            run_supervisor()
        except KeyboardInterrupt:
            self.stdout.write("\nStopped.")
