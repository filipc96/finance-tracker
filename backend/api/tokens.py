"""Login (token-obtain) serializer/view that unlocks the master-password vault.

Kept separate from `api/auth.py` because these import `simplejwt.views`, which
depends on `rest_framework.views`/`schemas`. `auth.py` is imported during DRF
settings initialization; importing this here instead avoids that circular
import (this module is only imported from `urls.py`, after startup).

The typed password is available in the serializer (and only here), so this is
where the vault is unlocked: derive the KEK, unwrap the DEK, hold it in memory.
A pre-vault account's first login lazily creates the vault and migrates its
keyfile-encrypted secrets to the DEK, returning a one-time `recovery_key`.
"""

from django.conf import settings as django_settings
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from . import vault


class VaultTokenObtainPairSerializer(TokenObtainPairSerializer):
    """TokenObtainPair that unlocks the vault with the just-verified password.

    Gated to DESKTOP_MODE: the master-password vault is a desktop feature. In
    web/dev mode this is a plain token-obtain and the four secrets stay on the
    keyfile exactly as before (no vault, no in-memory DEK, no re-login needed
    after a server restart).
    """

    def validate(self, attrs):
        data = super().validate(attrs)
        if getattr(django_settings, "DESKTOP_MODE", False):
            # self.user is set by the parent once credentials verify.
            recovery_key = vault.ensure_unlocked(self.user, attrs.get("password"))
            if recovery_key:
                # Present only the first time a vault is created for this account.
                data["recovery_key"] = recovery_key
        return data


class VaultTokenObtainPairView(TokenObtainPairView):
    serializer_class = VaultTokenObtainPairSerializer
    # Rate-limit login attempts per IP (see DEFAULT_THROTTLE_RATES["login"]).
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"
