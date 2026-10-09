# Telegram Remote Access

You can drive Fintrax from your phone by messaging a Telegram bot — add
transactions and check your balance while away from the PC, the same way the
in-app Terminal works. The bot runs **inside the app** and reaches Telegram over
**outbound** long-polling, so it needs no port forwarding, public URL, tunnel,
or certificate and works behind home NAT unchanged. It only responds while the
desktop app is running.

## Setup

1. In Telegram, message **@BotFather** → `/newbot` → copy the **bot token**.
2. Message **@userinfobot** → copy your **numeric user ID**.
3. In the app: **Settings → Telegram / Remote access** → paste both, flip
   **Enable Telegram bot** on, and **Save**. It takes effect within ~15s — no
   restart needed.
4. Message your bot `help` to see the commands.

## Commands (add + read only)

```
help
add <expense|income> <category> <amount> [description]
balance
recent [n]         # last n transactions (default 5, max 20)
categories
```

Multi-word categories work (`add expense Dining Out 20`); amounts use your
account's base currency.

## Security notes

- **Allowlist is the only gate.** The bot obeys exactly one Telegram user ID
  (the one you configured). `from.id` is set by Telegram, not by message text,
  so it can't be spoofed. Messages from anyone else are silently ignored.
- **The bot token is stored alongside the database** (not vault-encrypted).
  This is deliberate: the poller starts headless at app launch, before any
  vault unlock, so it must read the token without the master password.
  Encrypting it with a key that sits next to the database would add no real
  protection. The token grants control of *the bot* (add/read only), never
  the vault — and the DB already lives in your per-user profile directory.
  This is the standard tradeoff for any always-on bot; treat the token like any
  credential and revoke it via @BotFather if leaked.
- **Replies traverse Telegram's servers** (cloud chats aren't end-to-end
  encrypted), so replies are kept terse — no full statement dumps.
- **No remote destructive operations** (no delete/edit) and **no remote vault
  unlock** — your master password never touches Telegram.

## Development

The bot also runs as a foreground management command against the dev database:

```bash
cd backend
python manage.py runserver          # in one shell
python manage.py telegram_bot       # in another (foreground poller)
```

Configure the token / user ID / enabled flag in the Settings page first.
Toggling **Enable Telegram bot** off stops responses within ~15s with no
restart.