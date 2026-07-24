"""Vault-aware authentication class.

This module is named in `REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"]`, so
it is imported *while DRF is still initializing its settings*. It must therefore
stay lightweight — importing only `simplejwt.authentication` (which does not
pull in `rest_framework.views`/`schemas`). The login serializer/view, which do
depend on `simplejwt.views`, live in `api/tokens.py` and are imported only from
`urls.py`, after app startup — keeping them out of this import cycle.

Auth is at the DRF layer (not Django sessions), so `VaultJWTAuthentication` is
the one reliable place that knows `request.user` on every authenticated
request. After the parent resolves the user, we copy that user's unlocked DEK
(if any) onto the request thread so `crypto._fernet()` can decrypt their
secrets; `VaultMiddleware` clears it again when the request ends.
"""

from rest_framework_simplejwt.authentication import JWTAuthentication

from . import vault


class VaultJWTAuthentication(JWTAuthentication):
    """JWTAuthentication that activates the user's unlocked DEK for the request."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, _token = result
            vault.set_current_dek(vault.get_dek(user.id))
        return result
