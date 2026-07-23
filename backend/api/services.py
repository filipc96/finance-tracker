"""Business logic run outside a single view (shared by process endpoints)."""

from datetime import date
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from django.db import transaction as db_transaction
from django.db.models import Sum

from .models import (
    Account,
    NetWorthSnapshot,
    PortfolioSnapshot,
    RecurringTransaction,
    SavingsAccount,
    SavingsTransaction,
    Transaction,
)

# Safety cap so a very old next_due can't loop forever (400 ≈ daily/13 months)
MAX_MATERIALIZATIONS_PER_ITEM = 400
# Savings catch-up cap (600 months = 50 years)
MAX_INTEREST_MONTHS = 600

FREQUENCY_DELTAS = {
    "daily": relativedelta(days=1),
    "weekly": relativedelta(weeks=1),
    "monthly": relativedelta(months=1),
    "yearly": relativedelta(years=1),
}


def process_recurring(user):
    """Materialize all due recurring transactions for a user.

    Creates Transactions one by one (balance signals must fire — never
    bulk_create) and advances next_due. Returns the number created.
    """
    today = date.today()
    created = 0

    due_items = RecurringTransaction.objects.filter(
        user=user, active=True, next_due__lte=today
    ).select_related("category")

    for item in due_items:
        delta = FREQUENCY_DELTAS[item.frequency]
        iterations = 0
        while item.next_due <= today and iterations < MAX_MATERIALIZATIONS_PER_ITEM:
            Transaction.objects.create(
                user=user,
                date=item.next_due,
                amount=item.amount,
                name=item.name,
                category=item.category,
                type=item.type,
            )
            item.next_due = item.next_due + delta
            created += 1
            iterations += 1
        item.save()

    return created


def upsert_net_worth_snapshot(user):
    """Record today's net worth from current balances and the cached
    portfolio value (never calls Trading 212 — rate limits)."""
    savings_total = (
        SavingsAccount.objects.filter(user=user, active=True).aggregate(
            total=Sum("balance")
        )["total"]
        or Decimal("0.00")
    )
    latest_portfolio = (
        PortfolioSnapshot.objects.filter(user=user).order_by("-date").first()
    )
    # Prefer the base-currency (RSD) converted value so net worth doesn't mix
    # currencies; fall back to the native total for rows predating conversion.
    if latest_portfolio:
        portfolio_value = (
            latest_portfolio.base_value
            if latest_portfolio.base_value is not None
            else latest_portfolio.total_value
        )
    else:
        portfolio_value = Decimal("0.00")

    # Fresh query — user.account may be a stale cached relation (recurring
    # materialization above can have just changed the balance)
    account_balance = Account.objects.get(user=user).balance

    NetWorthSnapshot.objects.update_or_create(
        user=user,
        date=date.today(),
        defaults={
            "account_balance": account_balance,
            "savings_total": savings_total,
            "portfolio_value": portfolio_value,
        },
    )


def next_month_first(d):
    """First day of the month after d."""
    return (d.replace(day=1) + relativedelta(months=1))


def process_savings_interest(user):
    """Post monthly interest for each active savings account.

    Nominal monthly rate (apy/12) — a documented simplification, not
    effective-APY compounding. Interest is posted on the 1st of each month
    following last_interest_date, catching up missed months. Returns the
    number of interest entries posted.
    """
    today = date.today()
    posted = 0

    accounts = SavingsAccount.objects.filter(
        user=user, active=True, apy_rate__gt=0
    )
    for account in accounts:
        with db_transaction.atomic():
            due = next_month_first(account.last_interest_date)
            iterations = 0
            while due <= today and iterations < MAX_INTEREST_MONTHS:
                monthly_rate = account.apy_rate / Decimal("1200")
                interest = (account.balance * monthly_rate).quantize(
                    Decimal("0.01")
                )
                account.balance += interest
                SavingsTransaction.objects.create(
                    account=account,
                    type="interest",
                    amount=interest,
                    balance_after=account.balance,
                    date=due,
                )
                account.last_interest_date = due
                due = next_month_first(due)
                posted += 1
                iterations += 1
            account.save()

    return posted
