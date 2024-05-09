from django.urls import path
from . import views


urlpatterns = [
    path(
        "transactions/", views.TransactionListCreate.as_view(), name="transaction-list"
    ),
    path(
        "transactions/delete/<int:pk>",
        views.TransactionDelete.as_view(),
        name="transaction-delete",
    ),
    path("categories/", views.CategoryListCreate.as_view(), name="category-list"),
    path(
        "categories/delete/<int:pk>",
        views.CategoryDelete.as_view(),
        name="transaction-delete",
    ),
]
