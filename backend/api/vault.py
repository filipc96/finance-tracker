"""Master-password vault: envelope encryption for per-account secrets.

Each account has a random **Data Encryption Key (DEK)** that actually encrypts
its four Settings secrets. The DEK never touches disk in the clear: it is
wrapped by a **Key Encryption Key (KEK)** derived from the account password
(scrypt + per-account salt) and, separately, by a one-time **recovery key**.

On login the typed password unwraps the DEK, which is held in *process memory
only* for the life of the sidecar (a fresh sidecar spawns each app launch, so
the DEK is naturally gone on restart and the password is required again). A
copied data folder is therefore useless without the password: `fernet.key`
still exists, but the four secrets are encrypted under the DEK, not the keyfile.

Password change re-wraps the DEK (no data re-encryption); a forgotten password
is recoverable via the recovery key. See the plan and `crypto._fernet()`, which
picks up the current thread's DEK when one is set.
"""

import base64
import os
import threading
import time

from django.conf import settings as dj_settings
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

# scrypt cost: 128 * r * N bytes of memory. N=2**14, r=8 -> ~16 MiB, which stays
# safely under OpenSSL's default maxmem (32 MiB) while remaining expensive to
# brute-force. p=1. Tuned for a login-time derivation (~tens of ms).
_SCRYPT_N = 2 ** 14
_SCRYPT_R = 8
_SCRYPT_P = 1
SALT_BYTES = 16

# The four Settings columns holding secrets, in a fixed order (used by the
# one-time keyfile->DEK migration).
SECRET_COLUMNS = (
    "open_ai_api_key",
    "anthropic_api_key",
    "t212_api_key",
    "t212_api_secret",
)


# --- key primitives --------------------------------------------------------

def new_salt() -> bytes:
    return os.urandom(SALT_BYTES)


def derive_kek(password: str, salt: bytes) -> bytes:
    """Derive a urlsafe-b64 Fernet key from a password + salt via scrypt."""
    kdf = Scrypt(salt=bytes(salt), length=32, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P)
    raw = kdf.derive(password.encode("utf-8"))
    return base64.urlsafe_b64encode(raw)


def new_dek() -> bytes:
    return Fernet.generate_key()


def new_recovery_key() -> bytes:
    """A high-entropy recovery key that is itself a valid Fernet key."""
    return Fernet.generate_key()


def format_recovery_key(key: bytes) -> str:
    """Human-friendly grouping for one-time display (spaces every 8 chars).

    A space separator is used deliberately: the recovery key is urlsafe base64,
    whose alphabet already includes '-' and '_', so a dash separator would be
    indistinguishable from the key's own characters on parse.
    """
    s = key.decode("utf-8")
    return " ".join(s[i:i + 8] for i in range(0, len(s), 8))


def parse_recovery_key(text: str) -> bytes:
    """Inverse of format_recovery_key; strips only whitespace."""
    return "".join(text.split()).encode("utf-8")


def wrap(dek: bytes, key: bytes) -> str:
    """Encrypt (wrap) a DEK under a KEK/recovery key -> storable token."""
    return Fernet(key).encrypt(dek).decode("utf-8")


def unwrap(token: str, key: bytes) -> bytes:
    """Decrypt (unwrap) a DEK; raises InvalidToken on the wrong key."""
    return Fernet(key).decrypt(token.encode("utf-8"))


# --- in-memory session store (never persisted) -----------------------------

_UNLOCKED: dict[int, bytes] = {}
_LAST_SEEN: dict[int, float] = {}  # user_id -> monotonic time of last activity
_LOCK = threading.Lock()
_local = threading.local()

# Idle window before the in-memory DEK is dropped and the user must re-enter
# their password. Overridable via settings.VAULT_IDLE_TIMEOUT_SECONDS; a value
# of 0 (or less) disables idle re-locking.
_DEFAULT_IDLE_TIMEOUT = 15 * 60


def _idle_timeout() -> float:
    return float(getattr(dj_settings, "VAULT_IDLE_TIMEOUT_SECONDS", _DEFAULT_IDLE_TIMEOUT))


def _still_unlocked(user_id: int, now: float) -> bool:
    """Drop the DEK if idle past the timeout. Caller must hold ``_LOCK``.

    Returns whether the user remains unlocked after the check.
    """
    if user_id not in _UNLOCKED:
        return False
    timeout = _idle_timeout()
    if timeout > 0 and now - _LAST_SEEN.get(user_id, 0.0) > timeout:
        _UNLOCKED.pop(user_id, None)
        _LAST_SEEN.pop(user_id, None)
        return False
    return True


def unlock_user(user_id: int, dek: bytes) -> None:
    with _LOCK:
        _UNLOCKED[user_id] = dek
        _LAST_SEEN[user_id] = time.monotonic()


def lock_user(user_id: int) -> None:
    with _LOCK:
        _UNLOCKED.pop(user_id, None)
        _LAST_SEEN.pop(user_id, None)


def is_unlocked(user_id: int) -> bool:
    # A pure state check; it must not count as activity, or polling the vault
    # state would keep the DEK alive forever.
    with _LOCK:
        return _still_unlocked(user_id, time.monotonic())


def get_dek(user_id: int):
    # Called by the auth layer on every authenticated request (see auth.py), so
    # a hit here is genuine user activity: refresh the idle clock on the way out.
    with _LOCK:
        now = time.monotonic()
        if not _still_unlocked(user_id, now):
            return None
        _LAST_SEEN[user_id] = now
        return _UNLOCKED.get(user_id)


# --- per-request current DEK (thread-local; read by crypto._fernet) --------

def set_current_dek(dek) -> None:
    _local.dek = dek


def get_current_dek():
    return getattr(_local, "dek", None)


def clear_current_dek() -> None:
    _local.dek = None


# --- high-level vault operations -------------------------------------------

def create_vault(user, password: str) -> str:
    """Create (or reset) the user's Vault and unlock it.

    Generates a fresh DEK, wraps it by the password-derived KEK and by a new
    recovery key, persists the Vault, and holds the DEK in memory. Returns the
    plaintext recovery key formatted for one-time display — the caller must
    surface it and never store it.
    """
    from .models import Vault

    salt = new_salt()
    dek = new_dek()
    recovery_key = new_recovery_key()
    Vault.objects.update_or_create(
        user=user,
        defaults={
            "kdf_salt": salt,
            "wrapped_dek": wrap(dek, derive_kek(password, salt)),
            "recovery_wrapped_dek": wrap(dek, recovery_key),
        },
    )
    unlock_user(user.id, dek)
    return format_recovery_key(recovery_key)


def unlock_with_password(user, password: str) -> None:
    """Unwrap the DEK with the password and hold it in memory.

    Raises Vault.DoesNotExist if there is no vault, or
    cryptography.fernet.InvalidToken on the wrong password.
    """
    from .models import Vault

    vault = Vault.objects.get(user=user)
    dek = unwrap(vault.wrapped_dek, derive_kek(password, bytes(vault.kdf_salt)))
    unlock_user(user.id, dek)


def ensure_unlocked(user, password: str):
    """Unlock at login, lazily creating + migrating the vault on first use.

    Returns a one-time recovery key string only when the vault was *just*
    created (existing keyfile account's first login, or a brand-new account
    whose vault hadn't been made), so the caller can show it once; otherwise
    returns None. Raises InvalidToken on a wrong password for an existing vault.
    """
    from .models import Vault

    try:
        Vault.objects.get(user=user)
    except Vault.DoesNotExist:
        recovery = create_vault(user, password)
        migrate_keyfile_secrets_to_dek(user, get_dek(user.id))
        return recovery

    unlock_with_password(user, password)
    return None


def rewrap_password(user, old_password: str, new_password: str) -> None:
    """Re-wrap the DEK under a new password (no data re-encryption).

    Raises InvalidToken if old_password is wrong. The recovery-key wrapping is
    left untouched, so an existing recovery key stays valid across the change.
    """
    from .models import Vault

    vault = Vault.objects.get(user=user)
    dek = unwrap(vault.wrapped_dek, derive_kek(old_password, bytes(vault.kdf_salt)))
    salt = new_salt()
    vault.kdf_salt = salt
    vault.wrapped_dek = wrap(dek, derive_kek(new_password, salt))
    vault.save(update_fields=["kdf_salt", "wrapped_dek", "date_modified"])
    unlock_user(user.id, dek)


def recover(user, recovery_key_text: str, new_password: str) -> None:
    """Reset the password wrapping using the recovery key; unlock afterward.

    Raises InvalidToken if the recovery key is wrong. Does NOT change the Django
    auth password — the caller is responsible for user.set_password(new_password).
    """
    from .models import Vault

    vault = Vault.objects.get(user=user)
    dek = unwrap(vault.recovery_wrapped_dek, parse_recovery_key(recovery_key_text))
    salt = new_salt()
    vault.kdf_salt = salt
    vault.wrapped_dek = wrap(dek, derive_kek(new_password, salt))
    vault.save(update_fields=["kdf_salt", "wrapped_dek", "date_modified"])
    unlock_user(user.id, dek)


def migrate_keyfile_secrets_to_dek(user, dek) -> None:
    """One-time re-encryption of a user's secrets from the keyfile to the DEK.

    Runs at a user's first login after the vault feature ships (guaranteed once:
    afterwards the vault exists and login takes the unwrap path). Reads the raw
    ciphertext straight from SQLite, decrypts it with the legacy keyfile Fernet,
    then rewrites it through the ORM with the DEK active on this thread so
    EncryptedCharField re-encrypts under the DEK.
    """
    from django.db import connection

    from . import crypto

    cols = ", ".join(SECRET_COLUMNS)
    with connection.cursor() as cur:
        cur.execute(
            f"SELECT {cols} FROM api_settings WHERE user_id = %s", [user.id]
        )
        row = cur.fetchone()
    if not row:
        return

    keyfile = crypto.keyfile_fernet()
    plaintext = {}
    for col, raw in zip(SECRET_COLUMNS, row):
        if not raw:
            plaintext[col] = raw
            continue
        try:
            plaintext[col] = keyfile.decrypt(str(raw).encode("utf-8")).decode("utf-8")
        except Exception:
            # Already plaintext or already DEK-encrypted — leave the value as-is.
            plaintext[col] = raw

    set_current_dek(dek)
    try:
        settings_obj = user.settings
        for col, value in plaintext.items():
            setattr(settings_obj, col, value)
        settings_obj.save(update_fields=list(SECRET_COLUMNS) + ["date_modified"])
    finally:
        clear_current_dek()
