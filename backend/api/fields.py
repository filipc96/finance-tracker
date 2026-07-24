"""Custom model fields."""

from django.db import models

from . import crypto


class EncryptedCharField(models.CharField):
    """A CharField whose value is encrypted at rest.

    Encryption/decryption happen at the ORM boundary, so every reader
    (`getattr(settings, "open_ai_api_key")`, serializers, etc.) keeps working
    with plaintext and is completely unaware of the ciphertext in the column.

    Stored ciphertext is a Fernet token (longer than the plaintext), so give
    these columns generous `max_length`.
    """

    def from_db_value(self, value, expression, connection):
        return crypto.decrypt(value)

    def get_prep_value(self, value):
        return crypto.encrypt(super().get_prep_value(value))
