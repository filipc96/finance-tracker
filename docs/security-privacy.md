# Security & Privacy

## Data storage

Fintrax is a **local-first** application. Your financial data lives in a
SQLite database on your own machine:

| Platform | Default data directory |
|----------|----------------------|
| Windows  | `%APPDATA%\com.fintrax.app\` |
| Linux    | `~/.local/share/com.fintrax.app\` |
| macOS    | `~/.local/share/com.fintrax.app\` |

There is no cloud backend, telemetry, or remote storage. No account
registration is required.

## Encryption

- **API keys** (OpenAI, Anthropic, Trading 212) are encrypted at rest using
  envelope encryption: a scrypt-derived key-encryption key (KEK) wraps a
  random data-encryption key (DEK). The DEK lives in process memory only.
- **Transaction data, budgets, categories, and settings** are stored in
  plaintext SQLite. This is by design: the app needs to query, sort, and
  aggregate this data, which would be impractical on an encrypted-at-rest
  database. The trade-off is that if an attacker gains filesystem access to
  your machine while the app is not running, they can read your transactions
  but not your API keys. While the app is running, access to the database
  is controlled by your OS user account.
- **Master password** is never stored. The vault KEK is derived from it on
  each login using scrypt with a per-user salt. Password strength is enforced
  at registration via Django's built-in validators.
- **The Telegram bot token** is stored unencrypted alongside the database
  (see [Telegram security notes](telegram-remote.md#security-notes) for the
  reasoning).

## Network

All networking is **opt-in** and **outbound-only**:

| Feature | Connection | Protocol |
|---------|-----------|----------|
| **AI assistant** | Your API key → your chosen provider (OpenAI, Anthropic, Ollama, LM Studio) | HTTPS |
| **Trading 212 sync** | Your API key → Trading 212 API | HTTPS |
| **Telegram remote** | Bot token → Telegram API (long polling) | HTTPS |
| **Auto-updater** | GitHub Releases → your app (not yet active) | HTTPS |
| **Receipt OCR** | Local — runs on your machine via RapidOCR | — |

No inbound ports are opened. No data is sent to any server controlled by the
author. The app does not include tracking, analytics, crash reporting, or
telemetry.

## Backup

Back up your database regularly:

```bash
# Windows
copy %APPDATA%\com.fintrax.app\db.sqlite3 backup\
```

Restoring a backup: copy the file back and restart the app.

## Reporting a vulnerability

Open a [GitHub Security Advisory](https://github.com/filipc96/finance-tracker/security/advisories)
or email the maintainer directly.