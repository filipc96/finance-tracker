from django.contrib import admin
from django.urls import path, include
from api.views import ChangePasswordView, CreateUserView, GetUser
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/user/register/", CreateUserView.as_view(), name="register"),
    path("api/user/", GetUser.as_view(), name="get-user"),
    path(
        "api/user/change-password/",
        ChangePasswordView.as_view(),
        name="change-password",
    ),
    path("api/token/", TokenObtainPairView.as_view(), name="get-token"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("api-auth/", include("rest_framework.urls")),
    path("api/", include("api.urls")),
]
