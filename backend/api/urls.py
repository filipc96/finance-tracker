from django.urls import path
from . import views


urlpatterns = [
    path("transactions/", views.TransactionListCreate.as_view(), name="note-list"),
    path(
        "transactions/delete/<int:pk>",
        views.TransactionDelete.as_view(),
        name="note-delete",
    ),
]
