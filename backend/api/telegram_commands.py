"""Server-side command handlers for the Telegram remote-control bot.

Pure functions of ``(user, args) -> str``: no Telegram or HTTP knowledge lives
here, so every command is unit-testable without a network (see api/tests.py).
The long-poll supervisor in ``api/telegram_bot.py`` is the only caller in
production — it hands us the resolved ``User`` and the raw message text.

Command surface (add + read only, mirroring the in-app Terminal):

    help
    add <expense|income> <category> <amount> [description...]
    balance
    recent [n]
    categories
    yes / no — confirm or discard a staged receipt (see below)

Writes go through ``TransactionSerializer`` so validation (category ownership,
positive amount, entry-currency conversion) is identical to the web app.

Receipt photos are handled out-of-band: the poller downloads the image and calls
``stage_receipt(user, image_bytes)``, which OCRs + LLM-parses it (same engine as
the web "Scan Receipts") and holds a draft in ``_PENDING_RECEIPTS`` until the user
replies ``/yes`` (save) or ``/no`` (discard). Unlike the text commands, that path
needs the LLM API key, which lives in the vault — so it only works while the app
is unlocked (a locked reply asks the user to unlock and resend).
"""

from decimal import Decimal, InvalidOperation
from types import SimpleNamespace

from django.db.models import Sum
from django.utils import timezone

from .llm import LLMConfigError, LLMError, resolve_llm
from .models import Category, Transaction
from .receipts import ReceiptError, extract_text, parse_receipt
from .serializers import TransactionSerializer

# Staged receipt drafts awaiting /yes or /no, keyed by user id. In-memory is
# fine: confirmation is immediate and there is one user per install (v1).
_PENDING_RECEIPTS = {}

# Keep replies terse — they traverse Telegram's servers (cloud chats are not
# end-to-end encrypted), so we never dump a full statement.
MAX_RECENT = 20
DEFAULT_RECENT = 5


def fmt(amount, base_currency):
    """Render a money amount as e.g. ``1,234.56 USD`` (plain text, no symbol)."""
    try:
        value = Decimal(amount)
    except (InvalidOperation, TypeError, ValueError):
        value = Decimal("0")
    return f"{value:,.2f} {base_currency or 'USD'}"


def _base_currency(user):
    settings = getattr(user, "settings", None)
    return (getattr(settings, "base_currency", "") or "USD") if settings else "USD"


def cmd_help(user=None, args=None):
    return (
        "Fintrax bot commands:\n"
        "  add <expense|income> <category> <amount> [description]\n"
        "  balance — net, income and expense totals\n"
        "  recent [n] — last n transactions (default 5, max 20)\n"
        "  categories — list your categories\n"
        "  help — this message\n"
        "\n"
        "Send a photo of a receipt and I'll read it, then reply /yes to save "
        "it as an expense or /no to discard."
    )


def cmd_add(user, args):
    """Add one transaction. Mirrors the in-app Terminal's `add`.

    Grammar: ``add <type> <category...> <amount> [description...]`` where the
    amount is the first token after the type that parses as a positive number.
    Everything between the type and the amount is the category name (so
    multi-word categories like "Dining Out" work); everything after is the
    optional description.
    """
    if len(args) < 3:
        return "Usage: add <expense|income> <category> <amount> [description]"

    type_ = args[0].lower()
    if type_ not in ("expense", "income"):
        return f'Invalid type "{args[0]}". Use expense or income.'

    rest = args[1:]
    # Locate the amount: first token after the type that is a positive number.
    amount_idx = None
    for i, tok in enumerate(rest):
        try:
            if Decimal(tok) > 0:
                amount_idx = i
                break
        except (InvalidOperation, ValueError):
            continue
    if amount_idx is None or amount_idx == 0:
        return "Usage: add <expense|income> <category> <amount> [description]"

    category_name = " ".join(rest[:amount_idx])
    amount = Decimal(rest[amount_idx])
    description = " ".join(rest[amount_idx + 1:]).strip()

    category = (
        Category.objects.filter(user=user, type=type_, name__iexact=category_name)
        .first()
    )
    if category is None:
        available = list(
            Category.objects.filter(user=user, type=type_)
            .order_by("name")
            .values_list("name", flat=True)
        )
        hint = (
            "Available: " + ", ".join(available)
            if available
            else "No categories exist yet."
        )
        return f'Category "{category_name}" not found for {type_}.\n{hint}'

    name = description or category.name
    serializer = TransactionSerializer(
        data={
            "date": timezone.localdate().isoformat(),
            "amount": f"{amount:.2f}",
            "name": name,
            "category": category.id,
            "type": type_,
        },
        context={"request": SimpleNamespace(user=user)},
    )
    if not serializer.is_valid():
        errors = "; ".join(
            f"{field}: {' '.join(str(m) for m in msgs)}"
            for field, msgs in serializer.errors.items()
        )
        return f"Could not add: {errors}"

    serializer.save(user=user)
    base = _base_currency(user)
    return f'Added {type_} "{name}": {fmt(amount, base)} ({category.name})'


def cmd_balance(user, args=None):
    base = _base_currency(user)
    income = Transaction.objects.filter(user=user, type="income").aggregate(
        total=Sum("amount")
    )["total"] or Decimal("0")
    expense = Transaction.objects.filter(user=user, type="expense").aggregate(
        total=Sum("amount")
    )["total"] or Decimal("0")
    net = income - expense
    return (
        f"Balance: {fmt(net, base)}\n"
        f"Income:  {fmt(income, base)}\n"
        f"Expense: {fmt(expense, base)}"
    )


def cmd_recent(user, args=None):
    n = DEFAULT_RECENT
    if args:
        try:
            n = int(args[0])
        except (ValueError, TypeError):
            return f'Invalid count "{args[0]}".'
    n = max(1, min(n, MAX_RECENT))

    txns = list(
        Transaction.objects.filter(user=user)
        .select_related("category")
        .order_by("-date", "-id")[:n]
    )
    if not txns:
        return "No transactions yet."

    base = _base_currency(user)
    lines = [f"Last {len(txns)} transactions:"]
    for t in txns:
        sign = "-" if t.type == "expense" else "+"
        cat = t.category.name if t.category else "?"
        lines.append(f"{t.date}  {sign}{fmt(t.amount, base)}  {t.name} ({cat})")
    return "\n".join(lines)


def cmd_categories(user, args=None):
    expense = list(
        Category.objects.filter(user=user, type="expense")
        .order_by("name")
        .values_list("name", flat=True)
    )
    income = list(
        Category.objects.filter(user=user, type="income")
        .order_by("name")
        .values_list("name", flat=True)
    )
    return (
        "Expense: " + (", ".join(expense) or "(none)") + "\n"
        "Income:  " + (", ".join(income) or "(none)")
    )


def stage_receipt(user, image_bytes):
    """OCR + LLM-parse a receipt photo and stage a draft for /yes confirmation.

    Returns the reply string to send back to the user. The heavy lifting reuses
    the exact web "Scan Receipts" core (extract_text + parse_receipt), so the
    parse is identical. Requires the vault to be unlocked (the LLM key is
    encrypted); a locked vault surfaces as a decrypt failure inside resolve_llm,
    which we translate into a friendly "unlock and resend" reply.
    """
    try:
        text = extract_text(image_bytes)
    except ReceiptError as exc:
        return f"Couldn't read that receipt: {exc}"

    try:
        resolved = resolve_llm(user.settings)
    except LLMConfigError:
        return "Set up your chat LLM in Settings first, then resend the photo."
    except Exception:  # noqa: BLE001 - locked vault => key can't be decrypted
        return "Unlock the Fintrax app first, then resend the photo."

    expense_categories = list(
        Category.objects.filter(user=user, type="expense")
    )
    category_names = [c.name for c in expense_categories]

    try:
        draft = parse_receipt(text, resolved, category_names)
    except ReceiptError as exc:
        return f"Couldn't parse that receipt: {exc}"
    except LLMError:
        return "The LLM request failed. Try again in a moment."

    if not draft["total"]:
        return (
            "I read the receipt but couldn't find a total amount. "
            "Try a clearer photo, or add it with the `add` command."
        )

    # Match the suggested category to one the user already has (case-insensitive).
    matched_id = None
    matched_name = ""
    suggested = draft["suggested_category"]
    if suggested:
        for category in expense_categories:
            if category.name.casefold() == suggested.casefold():
                matched_id = category.id
                matched_name = category.name
                break

    merchant = draft["merchant"] or "Receipt"
    _PENDING_RECEIPTS[user.id] = {
        "name": merchant,
        "amount": draft["total"],
        "currency": draft["currency"],
        "category_id": matched_id,
        "category_name": matched_name or suggested,
    }

    base = _base_currency(user)
    shown_currency = draft["currency"] or base
    category_line = (
        matched_name
        if matched_id
        else (f"{suggested} (new category)" if suggested else "(uncategorized)")
    )
    return (
        f"Found: {merchant} · {draft['total']} {shown_currency} · "
        f"{draft['date']}\n"
        f"Category: {category_line}\n"
        "Reply /yes to save, /no to discard."
    )


def cmd_yes(user, args=None):
    """Confirm and save the receipt draft staged by stage_receipt()."""
    draft = _PENDING_RECEIPTS.pop(user.id, None)
    if draft is None:
        return "Nothing to confirm — send a receipt photo first."

    if draft["category_id"] is not None:
        category = Category.objects.filter(
            user=user, type="expense", pk=draft["category_id"]
        ).first()
    else:
        # Suggested a category the user doesn't have yet: create it (mirrors the
        # web "new:" path), falling back to a generic bucket if none was named.
        name = (draft["category_name"] or "Uncategorized").strip()[:100]
        category, _ = Category.objects.get_or_create(
            user=user, type="expense", name=name
        )

    if category is None:
        return "Couldn't resolve a category for that receipt. Discarded."

    serializer = TransactionSerializer(
        data={
            "date": timezone.localdate().isoformat(),
            "amount": draft["amount"],
            "name": draft["name"],
            "category": category.id,
            "type": "expense",
            "currency": draft["currency"] or "",
        },
        context={"request": SimpleNamespace(user=user)},
    )
    if not serializer.is_valid():
        errors = "; ".join(
            f"{field}: {' '.join(str(m) for m in msgs)}"
            for field, msgs in serializer.errors.items()
        )
        return f"Could not save: {errors}"

    serializer.save(user=user)
    shown_currency = draft["currency"] or _base_currency(user)
    return (
        f'Saved expense "{draft["name"]}": {fmt(draft["amount"], shown_currency)} '
        f"({category.name}) — now on your Dashboard."
    )


def cmd_no(user, args=None):
    """Discard the staged receipt draft, if any."""
    if _PENDING_RECEIPTS.pop(user.id, None) is None:
        return "Nothing to discard."
    return "Discarded."


_COMMANDS = {
    "help": cmd_help,
    "add": cmd_add,
    "balance": cmd_balance,
    "recent": cmd_recent,
    "categories": cmd_categories,
    "yes": cmd_yes,
    "no": cmd_no,
}


def dispatch(user, text):
    """Route a raw message to a handler and return the reply string.

    Reused verbatim by the poller and the tests. Unknown commands get a
    "not found" hint; handler exceptions are caught so a bad message can never
    take down the polling loop.
    """
    parts = (text or "").strip().split()
    if not parts:
        return "Empty command. Type `help`."
    command = parts[0].lower().lstrip("/")  # tolerate a leading slash
    args = parts[1:]

    handler = _COMMANDS.get(command)
    if handler is None:
        return f'Command not found: "{command}". Type `help`.'
    try:
        return handler(user, args)
    except Exception as exc:  # noqa: BLE001 - surface, don't crash the poller
        return f"Error running {command}: {exc}"
