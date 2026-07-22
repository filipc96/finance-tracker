"""Business logic run outside a single view (shared by process endpoints)."""

from datetime import date

from dateutil.relativedelta import relativedelta

from .models import RecurringTransaction, Transaction

# Safety cap so a very old next_due can't loop forever (400 ≈ daily/13 months)
MAX_MATERIALIZATIONS_PER_ITEM = 400

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
