from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from datetime import date

from dateutil.relativedelta import relativedelta

from .models import (
    Account,
    Budget,
    Category,
    NetWorthSnapshot,
    PortfolioSnapshot,
    RecurringTransaction,
    SavingsAccount,
    SavingsTransaction,
    Settings,
    Transaction,
)
from .t212 import T212AuthError, T212RateLimited


def create_user(username="alice", password="test-pass-123"):
    return User.objects.create_user(username=username, password=password)


def create_transaction(user, category, amount, type=None, date="2026-01-15", name="tx"):
    return Transaction.objects.create(
        user=user,
        category=category,
        amount=Decimal(amount),
        type=type or category.type,
        date=date,
        name=name,
    )


class AuthTests(APITestCase):
    def test_register_creates_account_and_settings(self):
        response = self.client.post(
            "/api/user/register/",
            {"username": "newuser", "password": "test-pass-123"},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="newuser")
        self.assertTrue(Account.objects.filter(user=user).exists())
        self.assertTrue(Settings.objects.filter(user=user).exists())
        self.assertEqual(user.account.balance, Decimal("0.00"))

    def test_token_obtain(self):
        create_user("alice", "test-pass-123")
        response = self.client.post(
            "/api/token/", {"username": "alice", "password": "test-pass-123"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_unauthenticated_requests_rejected(self):
        for url in [
            "/api/transactions/",
            "/api/categories/",
            "/api/settings/",
            "/api/user/",
        ]:
            response = self.client.get(url)
            self.assertEqual(
                response.status_code, status.HTTP_401_UNAUTHORIZED, url
            )


class TransactionTests(APITestCase):
    def setUp(self):
        self.user = create_user("alice")
        self.other = create_user("bob")
        self.client.force_authenticate(self.user)
        self.income = Category.objects.create(
            user=self.user, name="Salary", type="income"
        )
        self.expense = Category.objects.create(
            user=self.user, name="Food", type="expense"
        )

    def refresh_balance(self):
        self.user.account.refresh_from_db()
        return self.user.account.balance

    def test_create_income_increases_balance(self):
        response = self.client.post(
            "/api/transactions/",
            {
                "date": "2026-01-01",
                "amount": "100.00",
                "name": "pay",
                "category": self.income.id,
                "type": "income",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.refresh_balance(), Decimal("100.00"))

    def test_create_expense_decreases_balance(self):
        create_transaction(self.user, self.expense, "40.00")
        self.assertEqual(self.refresh_balance(), Decimal("-40.00"))

    def test_delete_reverts_balance(self):
        tx = create_transaction(self.user, self.income, "100.00")
        self.assertEqual(self.refresh_balance(), Decimal("100.00"))
        response = self.client.delete(f"/api/transactions/delete/{tx.id}")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.refresh_balance(), Decimal("0.00"))

    def test_list_is_paginated_and_user_scoped(self):
        other_cat = Category.objects.create(
            user=self.other, name="Other", type="expense"
        )
        create_transaction(self.other, other_cat, "5.00")
        for i in range(25):
            create_transaction(
                self.user, self.expense, "1.00", date=f"2026-01-{(i % 28) + 1:02d}"
            )

        response = self.client.get("/api/transactions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 25)
        self.assertEqual(len(response.data["results"]), 20)
        self.assertIsNotNone(response.data["next"])

        page2 = self.client.get("/api/transactions/?page=2")
        self.assertEqual(len(page2.data["results"]), 5)

    def test_cross_user_delete_404(self):
        other_cat = Category.objects.create(
            user=self.other, name="Other", type="expense"
        )
        tx = create_transaction(self.other, other_cat, "5.00")
        response = self.client.delete(f"/api/transactions/delete/{tx.id}")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_latest_endpoints_user_scoped(self):
        other_cat = Category.objects.create(
            user=self.other, name="Other", type="expense"
        )
        create_transaction(self.other, other_cat, "999.00", name="bobs")
        self.assertFalse(self.client.get("/api/transactions/expenses/latest").data)

        create_transaction(self.user, self.expense, "10.00", name="mine")
        response = self.client.get("/api/transactions/expenses/latest")
        self.assertEqual(response.data["name"], "mine")


class AggregateIsolationTests(APITestCase):
    def setUp(self):
        self.user = create_user("alice")
        self.other = create_user("bob")
        self.client.force_authenticate(self.user)
        mine = Category.objects.create(user=self.user, name="Food", type="expense")
        theirs = Category.objects.create(user=self.other, name="Food", type="expense")
        create_transaction(self.user, mine, "10.00", date="2026-01-15")
        create_transaction(self.other, theirs, "1000.00", date="2026-01-15")

    def test_monthly_sum_scoped(self):
        response = self.client.get("/api/transactions/monthly-sum/expense/2026/")
        self.assertEqual(response.data[0], Decimal("10.00"))

    def test_yearly_sum_scoped(self):
        response = self.client.get("/api/transactions/yearly-sum/expense/")
        self.assertEqual(response.data[2026], Decimal("10.00"))

    def test_all_time_sum_scoped(self):
        response = self.client.get("/api/transactions/all-time-sum/expense/")
        self.assertEqual(response.data, Decimal("10.00"))

    def test_timespan_scoped(self):
        response = self.client.get(
            "/api/transactions/transactions-by-timespan/expense/24/"
        )
        totals = [item["total"] for item in response.data]
        self.assertNotIn(Decimal("1010.00"), totals)

    def test_aggregates_require_auth(self):
        self.client.force_authenticate(None)
        for url in [
            "/api/transactions/yearly-sum/expense/",
            "/api/transactions/all-time-sum/expense/",
            "/api/transactions/transactions-by-timespan/expense/6/",
        ]:
            response = self.client.get(url)
            self.assertEqual(
                response.status_code, status.HTTP_401_UNAUTHORIZED, url
            )


class BudgetTests(APITestCase):
    def setUp(self):
        self.user = create_user("alice")
        self.other = create_user("bob")
        self.client.force_authenticate(self.user)
        self.food = Category.objects.create(
            user=self.user, name="Food", type="expense"
        )
        self.salary = Category.objects.create(
            user=self.user, name="Salary", type="income"
        )

    def test_create_normalizes_month(self):
        response = self.client.post(
            "/api/budgets/",
            {"category": self.food.id, "amount": "500.00", "month": "2026-07-15"},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["month"], "2026-07-01")

    def test_income_category_rejected(self):
        response = self.client.post(
            "/api/budgets/",
            {"category": self.salary.id, "amount": "500.00", "month": "2026-07-01"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_other_users_category_rejected(self):
        other_cat = Category.objects.create(
            user=self.other, name="Other", type="expense"
        )
        response = self.client.post(
            "/api/budgets/",
            {"category": other_cat.id, "amount": "500.00", "month": "2026-07-01"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_budget_rejected(self):
        Budget.objects.create(
            user=self.user,
            category=self.food,
            amount=Decimal("500.00"),
            month="2026-07-01",
        )
        response = self.client.post(
            "/api/budgets/",
            {"category": self.food.id, "amount": "300.00", "month": "2026-07-01"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_spent_annotation_scoped_to_month_and_user(self):
        Budget.objects.create(
            user=self.user,
            category=self.food,
            amount=Decimal("500.00"),
            month="2026-07-01",
        )
        create_transaction(self.user, self.food, "50.00", date="2026-07-10")
        create_transaction(self.user, self.food, "25.00", date="2026-07-20")
        # Different month + other user must not count
        create_transaction(self.user, self.food, "99.00", date="2026-06-10")
        other_cat = Category.objects.create(
            user=self.other, name="Food", type="expense"
        )
        create_transaction(self.other, other_cat, "1000.00", date="2026-07-10")

        response = self.client.get("/api/budgets/?month=2026-07")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["spent"], "75.00")

    def test_month_filter_returns_only_that_month(self):
        Budget.objects.create(
            user=self.user,
            category=self.food,
            amount=Decimal("500.00"),
            month="2026-07-01",
        )
        response = self.client.get("/api/budgets/?month=2026-06")
        self.assertEqual(response.data, [])

    def test_cross_user_detail_404(self):
        budget = Budget.objects.create(
            user=self.other,
            category=Category.objects.create(
                user=self.other, name="X", type="expense"
            ),
            amount=Decimal("100.00"),
            month="2026-07-01",
        )
        response = self.client.delete(f"/api/budgets/{budget.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class RecurringTests(APITestCase):
    def setUp(self):
        self.user = create_user("alice")
        self.client.force_authenticate(self.user)
        self.expense = Category.objects.create(
            user=self.user, name="Rent", type="expense"
        )

    def make_recurring(self, next_due, frequency="monthly", amount="100.00"):
        return RecurringTransaction.objects.create(
            user=self.user,
            name="Rent payment",
            amount=Decimal(amount),
            category=self.expense,
            type="expense",
            frequency=frequency,
            next_due=next_due,
        )

    def test_process_creates_due_transaction_and_advances(self):
        item = self.make_recurring(date.today())
        response = self.client.post("/api/process/")
        self.assertEqual(response.data["recurring_created"], 1)
        item.refresh_from_db()
        self.assertEqual(item.next_due, date.today() + relativedelta(months=1))
        self.assertEqual(Transaction.objects.filter(user=self.user).count(), 1)

    def test_process_catches_up_missed_months(self):
        self.make_recurring(date.today() - relativedelta(months=2))
        response = self.client.post("/api/process/")
        self.assertEqual(response.data["recurring_created"], 3)  # 2 back + today

    def test_process_updates_balance_via_signals(self):
        self.make_recurring(date.today(), amount="100.00")
        self.client.post("/api/process/")
        self.user.account.refresh_from_db()
        self.assertEqual(self.user.account.balance, Decimal("-100.00"))

    def test_process_is_idempotent_same_day(self):
        self.make_recurring(date.today())
        self.client.post("/api/process/")
        response = self.client.post("/api/process/")
        self.assertEqual(response.data["recurring_created"], 0)
        self.assertEqual(Transaction.objects.filter(user=self.user).count(), 1)

    def test_inactive_items_skipped(self):
        item = self.make_recurring(date.today())
        item.active = False
        item.save()
        response = self.client.post("/api/process/")
        self.assertEqual(response.data["recurring_created"], 0)

    def test_future_items_skipped(self):
        self.make_recurring(date.today() + relativedelta(days=1))
        response = self.client.post("/api/process/")
        self.assertEqual(response.data["recurring_created"], 0)

    def test_type_must_match_category(self):
        response = self.client.post(
            "/api/recurring/",
            {
                "name": "Bad",
                "amount": "10.00",
                "category": self.expense.id,
                "type": "income",
                "frequency": "monthly",
                "next_due": str(date.today()),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AnalyticsTests(APITestCase):
    def setUp(self):
        self.user = create_user("alice")
        self.other = create_user("bob")
        self.client.force_authenticate(self.user)
        self.food = Category.objects.create(
            user=self.user, name="Food", type="expense"
        )
        self.salary = Category.objects.create(
            user=self.user, name="Salary", type="income"
        )

    def test_monthly_summary_sums_and_net(self):
        create_transaction(self.user, self.salary, "1000.00", date="2026-03-05")
        create_transaction(self.user, self.food, "400.00", date="2026-03-10")
        other_cat = Category.objects.create(
            user=self.other, name="Other", type="expense"
        )
        create_transaction(self.other, other_cat, "999.00", date="2026-03-15")

        response = self.client.get("/api/analytics/monthly-summary/2026/")
        self.assertEqual(response.data["income"][2], Decimal("1000.00"))
        self.assertEqual(response.data["expense"][2], Decimal("400.00"))
        self.assertEqual(response.data["net"][2], Decimal("600.00"))

    def test_monthly_summary_empty_year_zeros(self):
        response = self.client.get("/api/analytics/monthly-summary/2020/")
        self.assertEqual(response.data["income"], [Decimal("0.00")] * 12)
        self.assertEqual(response.data["net"], [Decimal("0.00")] * 12)

    def test_category_trends_pivot_and_zero_fill(self):
        today = date.today()
        create_transaction(
            self.user, self.food, "30.00", date=str(today.replace(day=5))
        )
        response = self.client.get("/api/analytics/category-trends/expense/6/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        current_label = today.strftime("%Y-%m")
        self.assertIn(current_label, response.data["months"])
        food_series = next(
            c for c in response.data["categories"] if c["name"] == "Food"
        )
        index = response.data["months"].index(current_label)
        self.assertEqual(food_series["data"][index], Decimal("30.00"))
        # All other months zero-filled
        self.assertTrue(
            all(
                value == Decimal("0.00")
                for i, value in enumerate(food_series["data"])
                if i != index
            )
        )

    def test_category_trends_validation(self):
        self.assertEqual(
            self.client.get("/api/analytics/category-trends/transfer/6/").status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            self.client.get("/api/analytics/category-trends/expense/7/").status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_process_upserts_single_net_worth_snapshot(self):
        self.client.post("/api/process/")
        self.client.post("/api/process/")
        snapshots = NetWorthSnapshot.objects.filter(user=self.user)
        self.assertEqual(snapshots.count(), 1)

    def test_net_worth_series_combines_components(self):
        SavingsAccount.objects.create(
            user=self.user,
            name="Fund",
            balance=Decimal("500.00"),
            apy_rate=Decimal("0.00"),
            last_interest_date=date.today(),
        )
        create_transaction(self.user, self.salary, "100.00")
        self.client.post("/api/process/")

        response = self.client.get("/api/analytics/net-worth/")
        self.assertEqual(len(response.data), 1)
        entry = response.data[0]
        self.assertEqual(entry["account_balance"], Decimal("100.00"))
        self.assertEqual(entry["savings_total"], Decimal("500.00"))
        self.assertEqual(entry["net_worth"], Decimal("600.00"))

    def test_net_worth_series_user_scoped(self):
        NetWorthSnapshot.objects.create(
            user=self.other,
            date=date.today(),
            account_balance=Decimal("9999.00"),
            savings_total=Decimal("0.00"),
            portfolio_value=Decimal("0.00"),
        )
        response = self.client.get("/api/analytics/net-worth/")
        self.assertEqual(response.data, [])


class SavingsTests(APITestCase):
    def setUp(self):
        self.user = create_user("alice")
        self.other = create_user("bob")
        self.client.force_authenticate(self.user)

    def make_account(self, balance="1000.00", apy="12.00", months_ago=0):
        return SavingsAccount.objects.create(
            user=self.user,
            name="Fund",
            balance=Decimal(balance),
            apy_rate=Decimal(apy),
            last_interest_date=date.today() - relativedelta(months=months_ago),
        )

    def test_create_with_starting_balance_records_deposit(self):
        response = self.client.post(
            "/api/savings/",
            {"name": "Fund", "apy_rate": "4.50", "starting_balance": "500.00"},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        account = SavingsAccount.objects.get(user=self.user)
        self.assertEqual(account.balance, Decimal("500.00"))
        deposit = account.transactions.get()
        self.assertEqual(deposit.type, "deposit")
        self.assertEqual(deposit.balance_after, Decimal("500.00"))

    def test_single_month_interest_math(self):
        account = self.make_account(months_ago=1)
        response = self.client.post("/api/process/")
        self.assertEqual(response.data["interest_posted"], 1)
        account.refresh_from_db()
        # 1000 at 12% APY -> 1% monthly -> 10.00
        self.assertEqual(account.balance, Decimal("1010.00"))

    def test_catch_up_posts_one_entry_per_month(self):
        account = self.make_account(months_ago=3)
        response = self.client.post("/api/process/")
        self.assertEqual(response.data["interest_posted"], 3)
        account.refresh_from_db()
        self.assertEqual(
            account.transactions.filter(type="interest").count(), 3
        )
        self.assertGreater(account.last_interest_date, date.today() - relativedelta(months=1))

    def test_process_idempotent_same_day(self):
        self.make_account(months_ago=1)
        self.client.post("/api/process/")
        response = self.client.post("/api/process/")
        self.assertEqual(response.data["interest_posted"], 0)

    def test_inactive_and_zero_apy_skipped(self):
        account = self.make_account(months_ago=2)
        account.active = False
        account.save()
        SavingsAccount.objects.create(
            user=self.user,
            name="NoRate",
            balance=Decimal("1000.00"),
            apy_rate=Decimal("0.00"),
            last_interest_date=date.today() - relativedelta(months=2),
        )
        response = self.client.post("/api/process/")
        self.assertEqual(response.data["interest_posted"], 0)

    def test_withdraw_overdraft_rejected(self):
        account = self.make_account(balance="50.00")
        response = self.client.post(
            f"/api/savings/{account.id}/transactions/",
            {"type": "withdraw", "amount": "100.00"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        account.refresh_from_db()
        self.assertEqual(account.balance, Decimal("50.00"))

    def test_deposit_and_withdraw_update_balance_chain(self):
        account = self.make_account(balance="0.00")
        self.client.post(
            f"/api/savings/{account.id}/transactions/",
            {"type": "deposit", "amount": "200.00"},
        )
        self.client.post(
            f"/api/savings/{account.id}/transactions/",
            {"type": "withdraw", "amount": "80.00"},
        )
        account.refresh_from_db()
        self.assertEqual(account.balance, Decimal("120.00"))
        history = list(
            account.transactions.order_by("id").values_list(
                "balance_after", flat=True
            )
        )
        self.assertEqual(history, [Decimal("200.00"), Decimal("120.00")])

    def test_interest_type_rejected_from_clients(self):
        account = self.make_account()
        response = self.client.post(
            f"/api/savings/{account.id}/transactions/",
            {"type": "interest", "amount": "10.00"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cross_user_account_404(self):
        other_account = SavingsAccount.objects.create(
            user=self.other,
            name="Bobs",
            balance=Decimal("10.00"),
            apy_rate=Decimal("1.00"),
            last_interest_date=date.today(),
        )
        response = self.client.get(
            f"/api/savings/{other_account.id}/transactions/"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


SAMPLE_POSITION = {
    "instrument": {
        "ticker": "AAPL_US_EQ",
        "name": "Apple",
        "currency": "USD",
        "isin": "US0378331005",
    },
    "quantity": 2,
    "averagePricePaid": 150.0,
    "currentPrice": 200.0,
    "walletImpact": {
        "currency": "EUR",
        "currentValue": 380.0,
        "totalCost": 300.0,
        "unrealizedProfitLoss": 80.0,
        "fxImpact": -5.0,
    },
}

SAMPLE_CASH = {"free": 120.5, "currencyCode": "EUR"}


class StocksTests(APITestCase):
    def setUp(self):
        self.user = create_user("alice")
        self.client.force_authenticate(self.user)
        self.user.settings.t212_api_key = "key"
        self.user.settings.t212_api_secret = "secret"
        self.user.settings.save()
        # Keep tests hermetic: stub the FX conversion so no real HTTP call is
        # made. Returns (amount unchanged, rate 1) — base_value == total_value.
        fx_patcher = patch(
            "api.views.to_base",
            side_effect=lambda amount, currency, on=None: (
                Decimal(str(amount)),
                Decimal("1"),
            ),
        )
        fx_patcher.start()
        self.addCleanup(fx_patcher.stop)

    def _mock_client(self, mock_cls):
        instance = mock_cls.return_value
        instance.get_positions.return_value = [SAMPLE_POSITION]
        instance.get_cash.return_value = SAMPLE_CASH
        return instance

    @patch("api.views.T212Client")
    def test_portfolio_normalizes_and_snapshots(self, mock_cls):
        self._mock_client(mock_cls)
        response = self.client.get("/api/stocks/portfolio/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["cash"], Decimal("120.50"))
        self.assertEqual(response.data["total_value"], Decimal("500.50"))
        self.assertEqual(response.data["invested"], Decimal("300.00"))
        self.assertEqual(response.data["currency"], "EUR")
        position = response.data["positions"][0]
        self.assertEqual(position["ticker"], "AAPL_US_EQ")
        self.assertEqual(position["unrealized_pl"], "80.00")
        self.assertEqual(
            PortfolioSnapshot.objects.filter(user=self.user).count(), 1
        )

    @patch("api.views.T212Client")
    def test_fresh_snapshot_served_from_cache(self, mock_cls):
        self._mock_client(mock_cls)
        self.client.get("/api/stocks/portfolio/")
        mock_cls.reset_mock()

        response = self.client.get("/api/stocks/portfolio/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_cls.assert_not_called()

    @patch("api.views.T212Client")
    def test_refresh_param_bypasses_cache_single_daily_row(self, mock_cls):
        self._mock_client(mock_cls)
        self.client.get("/api/stocks/portfolio/")
        self.client.get("/api/stocks/portfolio/?refresh=1")
        self.assertEqual(mock_cls.call_count, 2)
        self.assertEqual(
            PortfolioSnapshot.objects.filter(user=self.user).count(), 1
        )

    def test_missing_credentials_400(self):
        self.user.settings.t212_api_key = ""
        self.user.settings.save()
        response = self.client.get("/api/stocks/portfolio/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Settings page", response.data["error"])

    @patch("api.views.T212Client")
    def test_auth_error_400(self, mock_cls):
        mock_cls.return_value.get_positions.side_effect = T212AuthError()
        response = self.client.get("/api/stocks/portfolio/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("api.views.T212Client")
    def test_rate_limited_serves_stale_cache(self, mock_cls):
        self._mock_client(mock_cls)
        self.client.get("/api/stocks/portfolio/")

        mock_cls.return_value.get_positions.side_effect = T212RateLimited()
        response = self.client.get("/api/stocks/portfolio/?refresh=1")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["stale"])
        self.assertIn("warning", response.data)

    @patch("api.views.T212Client")
    def test_rate_limited_without_cache_429(self, mock_cls):
        mock_cls.return_value.get_positions.side_effect = T212RateLimited()
        response = self.client.get("/api/stocks/portfolio/")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class CSVTests(APITestCase):
    def setUp(self):
        self.user = create_user("alice")
        self.other = create_user("bob")
        self.client.force_authenticate(self.user)
        self.food = Category.objects.create(
            user=self.user, name="Food", type="expense"
        )

    def _upload(self, content):
        from django.core.files.uploadedfile import SimpleUploadedFile

        file = SimpleUploadedFile(
            "import.csv", content.encode("utf-8"), content_type="text/csv"
        )
        return self.client.post(
            "/api/transactions/import/", {"file": file}, format="multipart"
        )

    def test_export_is_user_scoped_with_header(self):
        create_transaction(self.user, self.food, "10.00", name="mine")
        other_cat = Category.objects.create(
            user=self.other, name="Other", type="expense"
        )
        create_transaction(self.other, other_cat, "99.00", name="bobs")

        response = self.client.get("/api/transactions/export/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = response.content.decode()
        self.assertIn("date,name,amount,type,category", content)
        self.assertIn("mine", content)
        self.assertNotIn("bobs", content)

    def test_import_happy_path_creates_category_and_updates_balance(self):
        response = self._upload(
            "date,name,amount,type,category\n"
            "2026-01-05,salary,1000.00,income,Salary\n"
            "2026-01-10,groceries,50.00,expense,Food\n"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["created"], 2)
        self.assertEqual(response.data["errors"], [])
        self.assertTrue(
            Category.objects.filter(
                user=self.user, name="Salary", type="income"
            ).exists()
        )
        self.user.account.refresh_from_db()
        self.assertEqual(self.user.account.balance, Decimal("950.00"))

    def test_import_reports_row_errors(self):
        response = self._upload(
            "date,name,amount,type,category\n"
            "2026-01-05,ok,10.00,expense,Food\n"
            "not-a-date,bad,10.00,expense,Food\n"
            "2026-01-06,bad-amount,abc,expense,Food\n"
            "2026-01-07,bad-type,10.00,transfer,Food\n"
        )
        self.assertEqual(response.data["created"], 1)
        self.assertEqual(len(response.data["errors"]), 3)
        self.assertEqual(response.data["errors"][0]["row"], 3)

    def test_import_missing_column_rejected(self):
        response = self._upload("date,name,amount\n2026-01-05,x,10.00\n")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_import_requires_file(self):
        response = self.client.post("/api/transactions/import/", {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ChatTests(APITestCase):
    def setUp(self):
        self.user = create_user("alice")
        self.client.force_authenticate(self.user)
        self.user.settings.open_ai_api_key = "sk-test"
        self.user.settings.save()

    @patch("api.views.get_chat_completion", return_value="Here is your answer.")
    def test_chat_success(self, mock_completion):
        response = self.client.post("/api/chat/", {"message": "How am I doing?"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["response"], "Here is your answer.")
        resolved = mock_completion.call_args.args[0]
        self.assertEqual(resolved["provider"], "openai")
        self.assertEqual(resolved["model"], "gpt-5-mini")

    @patch("api.views.get_chat_completion", return_value="ok")
    def test_chat_context_includes_transactions(self, mock_completion):
        cat = Category.objects.create(user=self.user, name="Food", type="expense")
        create_transaction(self.user, cat, "42.00", name="groceries-run")

        self.client.post("/api/chat/", {"message": "What did I buy?"})

        system_prompt = mock_completion.call_args.args[1]
        self.assertIn("groceries-run", system_prompt)
        self.assertIn("Food", system_prompt)

    @patch("api.views.get_chat_completion", return_value="ok")
    def test_chat_provider_and_model_override(self, mock_completion):
        self.user.settings.anthropic_api_key = "sk-ant"
        self.user.settings.save()
        self.client.post(
            "/api/chat/",
            {"message": "hi", "provider": "anthropic", "model": "claude-opus-4-6"},
        )
        resolved = mock_completion.call_args.args[0]
        self.assertEqual(resolved["provider"], "anthropic")
        self.assertEqual(resolved["model"], "claude-opus-4-6")

    @patch("api.views.get_chat_completion", return_value="ok")
    def test_chat_uses_settings_provider(self, mock_completion):
        self.user.settings.llm_provider = "ollama"
        self.user.settings.llm_model = "llama3"
        self.user.settings.save()
        self.client.post("/api/chat/", {"message": "hi"})
        resolved = mock_completion.call_args.args[0]
        self.assertEqual(resolved["provider"], "ollama")
        self.assertEqual(resolved["model"], "llama3")
        self.assertEqual(resolved["api_key"], "ollama")
        self.assertEqual(resolved["base_url"], "http://localhost:11434/v1")

    def test_chat_requires_message(self):
        response = self.client.post("/api/chat/", {"message": "  "})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_chat_missing_openai_key(self):
        self.user.settings.open_ai_api_key = ""
        self.user.settings.save()
        response = self.client.post("/api/chat/", {"message": "hi"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Settings page", response.data["error"])

    def test_chat_missing_anthropic_key(self):
        response = self.client.post(
            "/api/chat/", {"message": "hi", "provider": "anthropic"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Anthropic", response.data["error"])

    def test_chat_local_provider_requires_model(self):
        response = self.client.post(
            "/api/chat/", {"message": "hi", "provider": "ollama"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("model", response.data["error"].lower())

    def test_chat_unknown_provider(self):
        response = self.client.post(
            "/api/chat/", {"message": "hi", "provider": "grok"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("api.views.get_chat_completion")
    def test_chat_local_connection_error_502(self, mock_completion):
        from .llm import LLMConnectionError

        mock_completion.side_effect = LLMConnectionError(
            "Could not connect to Ollama at http://localhost:11434/v1. "
            "Is it running?"
        )
        response = self.client.post(
            "/api/chat/", {"message": "hi", "provider": "ollama", "model": "llama3"}
        )
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertIn("running", response.data["error"])

    def test_chat_requires_auth(self):
        self.client.force_authenticate(None)
        response = self.client.post("/api/chat/", {"message": "hi"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class LLMUnitTests(APITestCase):
    def setUp(self):
        self.user = create_user("alice")
        self.settings = self.user.settings

    def test_resolve_openai_defaults(self):
        from .llm import resolve_llm

        self.settings.open_ai_api_key = "sk-x"
        resolved = resolve_llm(self.settings)
        self.assertEqual(resolved["model"], "gpt-5-mini")
        self.assertIsNone(resolved["base_url"])

    def test_resolve_local_base_url_override(self):
        from .llm import resolve_llm

        self.settings.ollama_base_url = "http://192.168.1.10:11434/v1"
        resolved = resolve_llm(self.settings, provider="ollama", model="llama3")
        self.assertEqual(resolved["base_url"], "http://192.168.1.10:11434/v1")

    @patch("api.llm.OpenAI")
    def test_openai_compat_client_kwargs(self, mock_openai):
        from .llm import get_chat_completion

        completion = MagicMock()
        completion.choices = [MagicMock(message=MagicMock(content="hi"))]
        mock_openai.return_value.chat.completions.create.return_value = completion

        resolved = {
            "provider": "lmstudio",
            "label": "LM Studio",
            "kind": "openai_compat",
            "model": "qwen",
            "api_key": "lm-studio",
            "base_url": "http://localhost:1234/v1",
        }
        text = get_chat_completion(resolved, "sys", "msg")
        self.assertEqual(text, "hi")
        _, kwargs = mock_openai.call_args
        self.assertEqual(kwargs["api_key"], "lm-studio")
        self.assertEqual(kwargs["base_url"], "http://localhost:1234/v1")

    @patch("api.llm.anthropic_sdk.Anthropic")
    def test_anthropic_text_extraction(self, mock_anthropic):
        from .llm import get_chat_completion

        block = MagicMock()
        block.type = "text"
        block.text = "claude says hi"
        mock_anthropic.return_value.messages.create.return_value = MagicMock(
            content=[block]
        )
        resolved = {
            "provider": "anthropic",
            "label": "Anthropic",
            "kind": "anthropic",
            "model": "claude-sonnet-4-6",
            "api_key": "sk-ant",
            "base_url": None,
        }
        text = get_chat_completion(resolved, "sys", "msg")
        self.assertEqual(text, "claude says hi")
        create_kwargs = mock_anthropic.return_value.messages.create.call_args.kwargs
        self.assertEqual(create_kwargs["system"], "sys")


class ChatProvidersTests(APITestCase):
    def setUp(self):
        self.user = create_user("alice")
        self.client.force_authenticate(self.user)

    @patch("api.llm._list_local_models", return_value=["llama3", "mistral"])
    def test_providers_listing(self, mock_local):
        self.user.settings.open_ai_api_key = "sk-x"
        self.user.settings.llm_provider = "ollama"
        self.user.settings.llm_model = "llama3"
        self.user.settings.save()

        response = self.client.get("/api/chat/providers/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["active"]["provider"], "ollama")

        providers = {p["name"]: p for p in response.data["providers"]}
        self.assertTrue(providers["openai"]["configured"])
        self.assertFalse(providers["anthropic"]["configured"])
        self.assertEqual(providers["ollama"]["models"], ["llama3", "mistral"])

    @patch("api.llm.requests.get", side_effect=Exception)
    def test_local_probe_failure_reports_error(self, mock_get):
        import requests as requests_lib

        mock_get.side_effect = requests_lib.ConnectionError()
        response = self.client.get("/api/chat/providers/")
        providers = {p["name"]: p for p in response.data["providers"]}
        self.assertEqual(providers["ollama"]["models"], [])
        self.assertIn("not reachable", providers["ollama"]["error"])

    def test_settings_llm_round_trip(self):
        payload = {
            "llm_provider": "lmstudio",
            "llm_model": "qwen2.5",
            "anthropic_api_key": "sk-ant",
            "ollama_base_url": "http://10.0.0.5:11434/v1",
            "lmstudio_base_url": "",
        }
        post = self.client.post("/api/settings/", payload)
        self.assertEqual(post.status_code, status.HTTP_200_OK)
        get = self.client.get("/api/settings/")
        for key, value in payload.items():
            self.assertEqual(get.data[key], value)


class ChangePasswordTests(APITestCase):
    def setUp(self):
        self.user = create_user("alice", "old-pass-123")
        self.client.force_authenticate(self.user)

    def test_change_password_success(self):
        response = self.client.post(
            "/api/user/change-password/",
            {"old_password": "old-pass-123", "new_password": "new-pass-456"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("new-pass-456"))

    def test_wrong_old_password(self):
        response = self.client.post(
            "/api/user/change-password/",
            {"old_password": "wrong", "new_password": "new-pass-456"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_weak_new_password_rejected(self):
        response = self.client.post(
            "/api/user/change-password/",
            {"old_password": "old-pass-123", "new_password": "123"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class CategoryTests(APITestCase):
    def setUp(self):
        self.user = create_user("alice")
        self.client.force_authenticate(self.user)

    def test_transactions_sum_annotation(self):
        cat = Category.objects.create(user=self.user, name="Food", type="expense")
        create_transaction(self.user, cat, "10.00")
        create_transaction(self.user, cat, "15.50")
        response = self.client.get("/api/categories/")
        self.assertEqual(response.data[0]["transactions_sum"], "25.50")

    def test_empty_category_sums_to_zero(self):
        Category.objects.create(user=self.user, name="Empty", type="expense")
        response = self.client.get("/api/categories/")
        self.assertEqual(response.data[0]["transactions_sum"], "0.00")

    def test_transactions_sum_ignored_on_create(self):
        response = self.client.post(
            "/api/categories/",
            {"name": "New", "type": "expense", "transactions_sum": "99.99"},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Category.objects.filter(user=self.user, name="New").exists()
        )


class FxTests(APITestCase):
    def _api_response(self, rates):
        mock = MagicMock()
        mock.raise_for_status.return_value = None
        mock.json.return_value = {"result": "success", "rates": rates}
        return mock

    @patch("api.fx.requests.get")
    def test_converts_and_caches(self, mock_get):
        from .fx import to_base
        from .models import ExchangeRate

        mock_get.return_value = self._api_response({"RSD": 100.0})
        value, rate = to_base(Decimal("10.00"), "USD")
        self.assertEqual(value, Decimal("1000.00"))
        self.assertEqual(rate, Decimal("100"))
        self.assertEqual(ExchangeRate.objects.count(), 1)

        # Second call is served from cache — no second HTTP hit.
        to_base(Decimal("5.00"), "USD")
        self.assertEqual(mock_get.call_count, 1)

    @patch("api.fx.requests.get")
    def test_same_currency_is_identity(self, mock_get):
        from .fx import to_base

        value, rate = to_base(Decimal("42.00"), "RSD")
        self.assertEqual(value, Decimal("42.00"))
        self.assertEqual(rate, Decimal("1"))
        mock_get.assert_not_called()

    @patch("api.fx.requests.get")
    def test_network_failure_without_cache_raises(self, mock_get):
        import requests as _requests
        from .fx import to_base, FxError

        mock_get.side_effect = _requests.RequestException("boom")
        with self.assertRaises(FxError):
            to_base(Decimal("1.00"), "USD")
