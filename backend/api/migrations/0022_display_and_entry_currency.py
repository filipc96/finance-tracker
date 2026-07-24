"""Display currency + per-recurring entry currency.

Purely additive — no existing amount or balance is touched:
  * Settings.display_currency: new, blank (== follow base). No backfill needed.
  * RecurringTransaction.currency: new; backfilled to each rule owner's
    base_currency so existing rules keep materializing 1:1 (currency == base
    means no FX conversion at fire time — identical to old behavior).

The transactions table is deliberately not altered.
"""

from django.db import migrations, models


def backfill_recurring_currency(apps, schema_editor):
    Settings = apps.get_model("api", "Settings")
    RecurringTransaction = apps.get_model("api", "RecurringTransaction")

    base_by_user = dict(
        Settings.objects.values_list("user_id", "base_currency")
    )
    for item in RecurringTransaction.objects.all().iterator():
        item.currency = base_by_user.get(item.user_id, "USD")
        item.save(update_fields=["currency"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0021_settings_base_currency"),
    ]

    operations = [
        migrations.AddField(
            model_name="settings",
            name="display_currency",
            field=models.CharField(blank=True, default="", max_length=3),
        ),
        migrations.AddField(
            model_name="recurringtransaction",
            name="currency",
            field=models.CharField(blank=True, default="", max_length=3),
        ),
        migrations.RunPython(backfill_recurring_currency, noop),
    ]
