"""Telegram remote-control bot: a long-poll supervisor run inside the sidecar.

Design (see the plan and README): the bot talks to Telegram over **outbound**
HTTPS via `getUpdates` long polling, so it works behind home NAT with no port
forward, tunnel, public URL, or cert. It runs as a single daemon thread started
unconditionally at sidecar boot; it reads its config from the per-user
``Settings`` row **each cycle**, so enabling/disabling or swapping the token from
the in-app Settings page takes effect without restarting the app.

Only one user is served per install (v1): the single ``Settings`` row that has
``telegram_enabled=True`` and a non-empty token. That row also identifies the
owning ``User``. Every incoming message is checked against
``telegram_allowed_user_id`` (the numeric Telegram id) before it is ever
dispatched — anything else is silently dropped.

The text commands (add/read) touch only plaintext models, so the bot answers
even when the vault is locked. The one exception is a **receipt photo**: parsing
it needs the LLM API key, which is vault-encrypted, so that path works only while
the app is unlocked and otherwise replies asking the user to unlock and resend
(the parse never crashes the loop).
"""

import threading
import time

import requests

API_BASE = "https://api.telegram.org/bot{token}/{method}"

# getUpdates long-poll window (server holds the request open this long waiting
# for a message); the HTTP read timeout is a bit longer so a normal empty poll
# isn't treated as an error.
POLL_TIMEOUT = 30
READ_TIMEOUT = POLL_TIMEOUT + 10
# When no bot is configured we idle-poll the DB cheaply at this cadence.
IDLE_SLEEP = 15
# Backoff after a network/HTTP error so a flaky link doesn't hot-loop.
ERROR_SLEEP = 10

_started = False
_started_lock = threading.Lock()


def _api(token, method, **params):
    """Call one Telegram Bot API method, returning the parsed `result` or None."""
    url = API_BASE.format(token=token, method=method)
    resp = requests.get(url, params=params, timeout=(10, READ_TIMEOUT))
    resp.raise_for_status()
    payload = resp.json()
    if not payload.get("ok"):
        raise RuntimeError(payload.get("description", "telegram API error"))
    return payload.get("result")


def _send_message(token, chat_id, text):
    # Best-effort: a failed reply must not abort the loop.
    try:
        _api(token, "sendMessage", chat_id=chat_id, text=text)
    except Exception as exc:  # noqa: BLE001
        print(f"[telegram] sendMessage failed: {exc}", flush=True)


def _get_file_path(token, file_id):
    """Resolve a Telegram file_id to its downloadable server path."""
    result = _api(token, "getFile", file_id=file_id)
    return (result or {}).get("file_path")


def _download_file(token, file_path):
    """Download a Telegram file's bytes given the path from getFile."""
    url = f"https://api.telegram.org/file/bot{token}/{file_path}"
    resp = requests.get(url, timeout=(10, READ_TIMEOUT))
    resp.raise_for_status()
    return resp.content


def _extract_image_file_id(message):
    """Return the file_id of an image in a message, or None.

    Prefers a sent photo (largest rendition = last entry); also accepts a
    document whose mime-type is an image (photos "sent as file").
    """
    photos = message.get("photo")
    if photos:
        return photos[-1].get("file_id")
    document = message.get("document") or {}
    if str(document.get("mime_type", "")).startswith("image/"):
        return document.get("file_id")
    return None


def is_allowed(from_id, allowed_id):
    """True iff this Telegram sender matches the configured allowlist id.

    `from.id` is set by Telegram (not the message body), so an exact string
    match against the single configured id is the whole gate. A blank configured
    id allows no one.
    """
    allowed = (allowed_id or "").strip()
    return bool(allowed) and str(from_id) == allowed


def _load_config():
    """Return the active (settings, user) pair, or (None, None) if unconfigured.

    Imported lazily and re-read every cycle so Settings edits apply live.
    """
    from .models import Settings

    settings = (
        Settings.objects.filter(telegram_enabled=True)
        .exclude(telegram_bot_token="")
        .select_related("user")
        .first()
    )
    if settings is None:
        return None, None
    return settings, settings.user


def run_supervisor():
    """Poll Telegram and dispatch commands until the process exits.

    Never raises: every network/parse error is caught and retried after a
    backoff so the bot can't take down the sidecar. Config is reloaded each
    cycle. The in-memory `offset` acknowledges processed updates to Telegram.
    """
    from .telegram_commands import dispatch, stage_receipt

    offset = None
    startup_epoch = int(time.time())
    first_poll = True
    logged_waiting = False

    while True:
        settings, user = _load_config()
        if settings is None:
            if not logged_waiting:
                print("[telegram] no enabled bot configured; idling", flush=True)
                logged_waiting = True
            time.sleep(IDLE_SLEEP)
            continue
        logged_waiting = False

        token = settings.telegram_bot_token
        allowed_id = (settings.telegram_allowed_user_id or "").strip()

        try:
            params = {"timeout": POLL_TIMEOUT}
            if offset is not None:
                params["offset"] = offset
            updates = _api(token, "getUpdates", **params) or []
        except Exception as exc:  # noqa: BLE001
            print(f"[telegram] getUpdates failed: {exc}", flush=True)
            time.sleep(ERROR_SLEEP)
            continue

        for update in updates:
            # Advance the offset past every update we see, even ignored ones,
            # so they are not redelivered on the next poll.
            offset = update["update_id"] + 1

            message = update.get("message") or update.get("edited_message")
            if not message:
                continue

            # Cold start: the first poll returns the backlog queued while the PC
            # was off. Skip anything older than our startup so we don't replay
            # stale commands — but still advance the offset past them (above).
            if first_poll and message.get("date", 0) < startup_epoch:
                continue

            from_id = str((message.get("from") or {}).get("id", ""))
            chat_id = (message.get("chat") or {}).get("id")
            text = message.get("text", "")

            # Allowlist: the sole gate. `from.id` is set by Telegram, not by the
            # message body, so it can't be spoofed via text.
            if not is_allowed(from_id, allowed_id):
                print(
                    f"[telegram] ignored message from unauthorized id {from_id}",
                    flush=True,
                )
                continue

            # Receipt photo: download the image and stage a draft. Wrapped so a
            # download/parse failure replies gracefully instead of crashing.
            image_file_id = _extract_image_file_id(message)
            if image_file_id:
                try:
                    file_path = _get_file_path(token, image_file_id)
                    image_bytes = _download_file(token, file_path)
                    reply = stage_receipt(user, image_bytes)
                except Exception as exc:  # noqa: BLE001
                    print(f"[telegram] receipt handling failed: {exc}", flush=True)
                    reply = "Couldn't process that photo. Try again."
                if chat_id is not None:
                    _send_message(token, chat_id, reply)
                continue

            if not text:
                continue

            reply = dispatch(user, text)
            if chat_id is not None:
                _send_message(token, chat_id, reply)

        first_poll = False


def start_background():
    """Start the supervisor once on a daemon thread. Safe to call repeatedly."""
    global _started
    with _started_lock:
        if _started:
            return
        _started = True
    thread = threading.Thread(
        target=run_supervisor, name="telegram-bot", daemon=True
    )
    thread.start()
    print("[telegram] supervisor thread started", flush=True)
