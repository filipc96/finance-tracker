"""Add the per-user base_currency setting.

New installs default to USD (the field default). Pre-existing rows are
backfilled to RSD, because before this setting existed the whole app was
hardcoded to Serbian Dinar — so the current owner's stored amounts are RSD
and must keep that label. Fresh buyers start on USD.
"""

from django.db import migrations, models


def backfill_existing_to_rsd(apps, schema_editor):
    Settings = apps.get_model("api", "Settings")
    Settings.objects.update(base_currency="RSD")


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0020_vault"),
    ]

    operations = [
        migrations.AddField(
            model_name="settings",
            name="base_currency",
            field=models.CharField(default="USD", max_length=3),
        ),
        migrations.RunPython(backfill_existing_to_rsd, noop),
    ]
