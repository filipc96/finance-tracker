"""Symmetric encryption for secrets stored at rest (API keys).

The four credential fields on the Settings model are encrypted before they
touch the SQLite file so a stolen/copied db.sqlite3 never exposes live
OpenAI/Anthropic/Trading 212 keys in plaintext.

Key management is deliberately *keyfile-based* rather than machine-bound
(Windows DPAPI): the Fernet key lives in a file next to the database, so
migrating an account to another machine is just "copy db.sqlite3 + fernet.key".
DPAPI would bind decryption to one Windows account and break that.

- Desktop mode (FINTRAX_DATA_DIR set): a random key in `<DATA_DIR>/fernet.key`,
  generated once on first run — mirrors the secret_key.txt pattern in
  backend/settings.py.
- Dev/web mode (no DATA_DIR): a key deterministically derived from Django's
  SECRET_KEY, so tests and the plain web server need no extra file. Override
  with FINTRAX_ENCRYPTION_KEY if you want an explicit key.
"""

import base64
import hashlib
import os
from functools import lru_cache
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken


def _derive_key_from_secret(secret: str) -> bytes:
    """32-byte urlsafe-b64 Fernet key derived from an arbitrary secret string."""
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


@lru_cache(maxsize=1)
def keyfile_fernet() -> Fernet:
    """The legacy keyfile/SECRET_KEY Fernet, independent of any per-user DEK.

    This is the fallback used whenever no master-password DEK is active (dev/web
    mode, tests, migrations, background work) and the source used to read
    pre-vault ciphertext during the one-time keyfile->DEK migration.
    """
    # Explicit override always wins (handy for tests / advanced setups).
    override = os.environ.get("FINTRAX_ENCRYPTION_KEY")
    if override:
        return Fernet(override.encode("utf-8") if isinstance(override, str) else override)

    data_dir = os.environ.get("FINTRAX_DATA_DIR")
    if data_dir:
        # Desktop mode: persist a real random key beside the DB.
        key_file = Path(data_dir) / "fernet.key"
        Path(data_dir).mkdir(parents=True, exist_ok=True)
        if key_file.exists():
            key = key_file.read_bytes().strip()
        else:
            key = Fernet.generate_key()
            key_file.write_bytes(key)
        return Fernet(key)

    # Dev/web mode: derive from Django's SECRET_KEY (stable across restarts).
    from django.conf import settings as django_settings

    return Fernet(_derive_key_from_secret(django_settings.SECRET_KEY))


def _fernet() -> Fernet:
    """Fernet for the current context.

    When a request has unlocked an account's master-password DEK (set on a
    thread-local by the vault-aware auth layer), encrypt/decrypt with *that*
    account's key so its secrets are readable only while unlocked. Otherwise
    fall back to the keyfile/SECRET_KEY Fernet — this keeps dev/web mode, the
    test suite, and data migrations working exactly as before.
    """
    from . import vault

    dek = vault.get_current_dek()
    if dek:
        return Fernet(dek)
    return keyfile_fernet()


def encrypt(value):
    """Encrypt a string. None/empty pass through unchanged."""
    if value is None or value == "":
        return value
    token = _fernet().encrypt(str(value).encode("utf-8"))
    return token.decode("utf-8")


def decrypt(value):
    """Decrypt a token. None/empty pass through; non-tokens returned as-is.

    Returning legacy plaintext untouched keeps pre-migration rows readable and
    makes the whole layer idempotent.
    """
    if value is None or value == "":
        return value
    try:
        return _fernet().decrypt(str(value).encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return value


def is_encrypted(value) -> bool:
    """True if `value` is a valid Fernet token for the current key."""
    if not value:
        return False
    try:
        _fernet().decrypt(str(value).encode("utf-8"))
        return True
    except InvalidToken:
        return False
