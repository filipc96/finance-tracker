from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse, JsonResponse
from django.urls import path, re_path, include
from api.views import (
    AccountListView,
    ChangePasswordView,
    CreateUserView,
    GetUser,
    VaultRecoverView,
    VaultStateView,
)
from api.tokens import VaultTokenObtainPairView
from rest_framework_simplejwt.views import TokenRefreshView


def health_view(request):
    return JsonResponse({"status": "ok"})


def spa_index(request):
    """Serve the built React app's index.html so client-side routes
    (e.g. /budgets, /settings) resolve on reload in desktop mode."""
    index_file = settings.FRONTEND_DIST_DIR / "index.html"
    return HttpResponse(index_file.read_bytes(), content_type="text/html")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health_view, name="health"),
    path("api/user/register/", CreateUserView.as_view(), name="register"),
    path("api/user/", GetUser.as_view(), name="get-user"),
    path(
        "api/user/change-password/",
        ChangePasswordView.as_view(),
        name="change-password",
    ),
    path("api/token/", VaultTokenObtainPairView.as_view(), name="get-token"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("api/accounts/", AccountListView.as_view(), name="accounts"),
    path("api/vault/state/", VaultStateView.as_view(), name="vault-state"),
    path("api/vault/recover/", VaultRecoverView.as_view(), name="vault-recover"),
    path("api-auth/", include("rest_framework.urls")),
    path("api/", include("api.urls")),
]

# Desktop mode: Django serves the SPA. WhiteNoise handles real files
# (/assets/*, /vite.svg, / -> index.html); this catch-all covers React
# Router deep links that aren't files. Never active in dev/web mode.
if settings.DESKTOP_MODE:
    urlpatterns += [
        re_path(
            r"^(?!api/|admin/|static/|health/).*$", spa_index, name="spa-index"
        ),
    ]
