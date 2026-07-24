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
        "transactions/update/<int:pk>",
        views.TransactionUpdate.as_view(),
        name="transaction-update",
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
        "transactions/transactions-by-timespan/<str:transaction_type>/<int:timespan>/",
        views.GetTransactionsByTimespan.as_view(),
        name="expense-by-time",
    ),
    path("settings/", views.SettingsListCreate.as_view(), name="settings"),
    path("chat/", views.ChatView.as_view(), name="chat"),
    path("receipts/scan/", views.ReceiptScanView.as_view(), name="receipt-scan"),
    path("chat/providers/", views.ChatProviders.as_view(), name="chat-providers"),
    path("budgets/", views.BudgetListCreate.as_view(), name="budget-list"),
    path("budgets/<int:pk>/", views.BudgetDetail.as_view(), name="budget-detail"),
    path(
        "transactions/export/",
        views.ExportTransactionsCSV.as_view(),
        name="transaction-export",
    ),
    path(
        "transactions/import/",
        views.ImportTransactionsCSV.as_view(),
        name="transaction-import",
    ),
    path("recurring/", views.RecurringListCreate.as_view(), name="recurring-list"),
    path(
        "recurring/delete/<int:pk>",
        views.RecurringDelete.as_view(),
        name="recurring-delete",
    ),
    path("process/", views.ProcessOnLoad.as_view(), name="process-on-load"),
    path("savings/", views.SavingsListCreate.as_view(), name="savings-list"),
    path(
        "savings/<int:pk>/",
        views.SavingsDetail.as_view(),
        name="savings-detail",
    ),
    path(
        "savings/<int:pk>/transactions/",
        views.SavingsTransactionListCreate.as_view(),
        name="savings-transactions",
    ),
    path(
        "stocks/portfolio/",
        views.StocksPortfolio.as_view(),
        name="stocks-portfolio",
    ),
    path(
        "analytics/net-worth/",
        views.NetWorthSeries.as_view(),
        name="net-worth-series",
    ),
    path(
        "analytics/monthly-summary/<int:year>/",
        views.MonthlySummary.as_view(),
        name="monthly-summary",
    ),
    path(
        "analytics/category-trends/<str:transaction_type>/<int:months>/",
        views.CategoryTrends.as_view(),
        name="category-trends",
    ),
]
