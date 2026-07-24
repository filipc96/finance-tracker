"""Request-scoped cleanup for the master-password DEK.

The unlocked DEK is put on a thread-local by `VaultJWTAuthentication` during a
request. waitress reuses worker threads across requests, so we must clear that
thread-local at the start and end of every request — otherwise one user's DEK
could linger on a thread and be picked up by the next request handled on it
(e.g. an unauthenticated call, or a different user). The persistent `_UNLOCKED`
map is untouched; only the per-thread current pointer is reset.
"""

from . import vault


class VaultMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        vault.clear_current_dek()
        try:
            return self.get_response(request)
        finally:
            vault.clear_current_dek()
