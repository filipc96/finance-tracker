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
    path(
        "transactions/expenses/latest",
        views.GetLatestExpense.as_view(),
        name="latest-expense",
    ),
    path(
        "transactions/incomes/latest",
        views.GetLatestIncome.as_view(),
        name="latest-income",
    ),
    path("categories/", views.CategoryListCreate.as_view(), name="category-list"),
    path(
        "categories/delete/<int:pk>",
        views.CategoryDelete.as_view(),
        name="transaction-delete",
    ),
    path(
        "transactions/monthly-sum/<str:transaction_type>/<int:year>/",
        views.GetMonthlyTransactionSum.as_view(),
        name="monthly-transaction-sum",
    ),
    path(
        "transactions/yearly-sum/<str:transaction_type>/",
        views.GetYearlyTransactionSum.as_view(),
        name="yearly-transaction-sum",
    ),
    path(
        "transactions/all-time-sum/<str:transaction_type>/",
        views.GetAllTimeTransactionSum.as_view(),
        name="all-time-sum",
    ),
    path(
        "transactions/expense-by-time/<str:time_period>/",
        views.GetExpensesByTime.as_view(),
        name="expense-by-time",
    ),
]
