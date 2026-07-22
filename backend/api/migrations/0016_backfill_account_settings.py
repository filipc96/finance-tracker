"""Backfill Account and Settings for users created before the auto-create
signals existed (legacy dev-database users hit 500s on every view that
touches user.account / user.settings)."""

from django.db import migrations


def backfill(apps, schema_editor):
    User = apps.get_model("auth", "User")
    Account = apps.get_model("api", "Account")
    Settings = apps.get_model("api", "Settings")

    for user in User.objects.all():
        Account.objects.get_or_create(user=user)
        Settings.objects.get_or_create(user=user)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0015_networthsnapshot"),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]
