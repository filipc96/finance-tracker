"""Encrypt the four Settings credential columns at rest.

Widens the columns (ciphertext is longer than plaintext), then encrypts any
existing plaintext values in place. Works directly on the raw columns via SQL
so it is independent of the ORM field class and idempotent (already-encrypted
values are detected and skipped).
"""

from django.db import migrations

import api.fields
from api import crypto


SECRET_COLUMNS = (
    "open_ai_api_key",
    "anthropic_api_key",
    "t212_api_key",
    "t212_api_secret",
)


def encrypt_existing(apps, schema_editor):
    connection = schema_editor.connection
    columns = ", ".join(SECRET_COLUMNS)
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT id, {columns} FROM api_settings")
        rows = cursor.fetchall()
        for row in rows:
            row_id = row[0]
            updates = {}
            for col, value in zip(SECRET_COLUMNS, row[1:]):
                if value and not crypto.is_encrypted(value):
                    updates[col] = crypto.encrypt(value)
            if updates:
                set_clause = ", ".join(f"{col} = %s" for col in updates)
                params = list(updates.values()) + [row_id]
                cursor.execute(
                    f"UPDATE api_settings SET {set_clause} WHERE id = %s", params
                )


def decrypt_existing(apps, schema_editor):
    connection = schema_editor.connection
    columns = ", ".join(SECRET_COLUMNS)
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT id, {columns} FROM api_settings")
        rows = cursor.fetchall()
        for row in rows:
            row_id = row[0]
            updates = {}
            for col, value in zip(SECRET_COLUMNS, row[1:]):
                if value and crypto.is_encrypted(value):
                    updates[col] = crypto.decrypt(value)
            if updates:
                set_clause = ", ".join(f"{col} = %s" for col in updates)
                params = list(updates.values()) + [row_id]
                cursor.execute(
                    f"UPDATE api_settings SET {set_clause} WHERE id = %s", params
                )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0018_portfoliosnapshot_base_currency_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="settings",
            name="open_ai_api_key",
            field=api.fields.EncryptedCharField(
                blank=True, max_length=500, null=True
            ),
        ),
        migrations.AlterField(
            model_name="settings",
            name="anthropic_api_key",
            field=api.fields.EncryptedCharField(
                blank=True, max_length=500, null=True
            ),
        ),
        migrations.AlterField(
            model_name="settings",
            name="t212_api_key",
            field=api.fields.EncryptedCharField(
                blank=True, max_length=500, null=True
            ),
        ),
        migrations.AlterField(
            model_name="settings",
            name="t212_api_secret",
            field=api.fields.EncryptedCharField(
                blank=True, max_length=500, null=True
            ),
        ),
        migrations.RunPython(encrypt_existing, decrypt_existing),
    ]
