from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import override_settings
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
    def setUp(self):
        # Login is ScopedRateThrottle'd; the LocMem cache persists across test
        # methods, so start each with an empty throttle bucket.
        cache.clear()

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

    def test_login_throttled_after_burst(self):
        create_user("alice", "test-pass-123")
        last = None
        for _ in range(11):
            last = self.client.post(
                "/api/token/", {"username": "alice", "password": "test-pass-123"}
            )
        # 10/min allowed, the 11th within the window is blocked.
        self.assertEqual(last.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


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

    def test_cross_user_category_rejected(self):
        other_cat = Category.objects.create(
            user=self.other, name="Other", type="expense"
        )
        response = self.client.post(
            "/api/transactions/",
            {
                "date": "2026-01-01",
                "amount": "10.00",
                "name": "x",
                "category": other_cat.id,
                "type": "expense",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.refresh_balance(), Decimal("0.00"))

    def test_non_positive_amount_rejected(self):
        for bad in ("0.00", "-5.00"):
            response = self.client.post(
                "/api/transactions/",
                {
                    "date": "2026-01-01",
                    "amount": bad,
                    "name": "x",
                    "category": self.expense.id,
                    "type": "expense",
                },
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_latest_endpoints_user_scoped(self):
        other_cat = Category.objects.create(
            user=self.other, name="Other", type="expense"
        )
        create_transaction(self.other, other_cat, "999.00", name="bobs")
        self.assertFalse(self.client.get("/api/transactions/expenses/latest").data)

        create_transaction(self.user, self.expense, "10.00", name="mine")
        response = self.client.get("/api/transactions/expenses/latest")
        self.assertEqual(response.data["name"], "mine")


class TransactionFilterTests(APITestCase):
    def setUp(self):
        self.user = create_user("alice")
        self.client.force_authenticate(self.user)
        self.income = Category.objects.create(
            user=self.user, name="Salary", type="income"
        )
        self.expense = Category.objects.create(
            user=self.user, name="Food", type="expense"
        )
        create_transaction(
            self.user, self.income, "1000.00", name="March salary", date="2026-03-01"
        )
        create_transaction(
            self.user, self.expense, "12.50", name="Groceries", date="2026-03-05"
        )
        create_transaction(
            self.user,
            self.expense,
            "80.00",
            name="Restaurant dinner",
            date="2026-02-20",
        )

    def _names(self, resp):
        return sorted(r["name"] for r in resp.data["results"])

    def test_search_by_name(self):
        resp = self.client.get("/api/transactions/?search=din")
        self.assertEqual(self._names(resp), ["Restaurant dinner"])

    def test_filter_by_type(self):
        resp = self.client.get("/api/transactions/?type=income")
        self.assertEqual(self._names(resp), ["March salary"])

    def test_filter_by_category(self):
        resp = self.client.get(f"/api/transactions/?category={self.expense.id}")
        self.assertEqual(self._names(resp), ["Groceries", "Restaurant dinner"])

    def test_filter_by_date_range(self):
        resp = self.client.get(
            "/api/transactions/?date_from=2026-03-01&date_to=2026-03-31"
        )
        self.assertEqual(self._names(resp), ["Groceries", "March salary"])

    def test_filter_by_amount_range(self):
        resp = self.client.get("/api/transactions/?min_amount=50&max_amount=500")
        self.assertEqual(self._names(resp), ["Restaurant dinner"])

    def test_combined_filters(self):
        resp = self.client.get("/api/transactions/?type=expense&min_amount=50")
        self.assertEqual(self._names(resp), ["Restaurant dinner"])

    def test_bad_filter_values_ignored(self):
        # Garbage filter params must not 500 — they're ignored, list unchanged.
        resp = self.client.get(
            "/api/transactions/?category=abc&date_from=notadate&min_amount=xyz"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 3)


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
        # Non-secret fields round-trip unchanged.
        for key in ("llm_provider", "llm_model", "ollama_base_url", "lmstudio_base_url"):
            self.assertEqual(get.data[key], payload[key])
        # The secret is never echoed back — only a has_* flag is exposed.
        self.assertNotIn("anthropic_api_key", get.data)
        self.assertTrue(get.data["has_anthropic_api_key"])


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


class LLMTokenParamTests(APITestCase):
    """GPT-5+ rejects max_tokens (needs max_completion_tokens); local
    OpenAI-compatible servers only understand max_tokens. Guard the split."""

    def _run(self, provider, base_url=None, model="m", temperature=None):
        from .llm import get_chat_completion

        resolved = {
            "provider": provider,
            "kind": "openai_compat",
            "label": "X",
            "model": model,
            "api_key": "k",
            "base_url": base_url,
        }
        with patch("api.llm.OpenAI") as mock_openai:
            client = mock_openai.return_value
            client.chat.completions.create.return_value = MagicMock(
                choices=[MagicMock(message=MagicMock(content="ok"))]
            )
            get_chat_completion(
                resolved, "sys", "msg", max_tokens=42, temperature=temperature
            )
            return client.chat.completions.create.call_args.kwargs

    def test_openai_uses_max_completion_tokens(self):
        kwargs = self._run("openai")
        self.assertEqual(kwargs.get("max_completion_tokens"), 42)
        self.assertNotIn("max_tokens", kwargs)

    def test_local_uses_max_tokens(self):
        kwargs = self._run("ollama", base_url="http://localhost:11434/v1")
        self.assertEqual(kwargs.get("max_tokens"), 42)
        self.assertNotIn("max_completion_tokens", kwargs)

    def test_temperature_omitted_when_none(self):
        kwargs = self._run("openai", model="gpt-4o-mini")
        self.assertNotIn("temperature", kwargs)

    def test_temperature_passed_for_non_reasoning_openai(self):
        kwargs = self._run("openai", model="gpt-4o-mini", temperature=0)
        self.assertEqual(kwargs.get("temperature"), 0)

    def test_temperature_dropped_for_openai_reasoning_model(self):
        # gpt-5* / o-series reject sampling params; must not be sent.
        kwargs = self._run("openai", model="gpt-5-mini", temperature=0)
        self.assertNotIn("temperature", kwargs)

    def test_temperature_passed_for_local(self):
        kwargs = self._run(
            "ollama", base_url="http://localhost:11434/v1", temperature=0
        )
        self.assertEqual(kwargs.get("temperature"), 0)


class ReceiptScanTests(APITestCase):
    def setUp(self):
        self.user = create_user("alice")
        self.client.force_authenticate(self.user)
        self.user.settings.open_ai_api_key = "sk-test"
        self.user.settings.save()

    def _image(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        return SimpleUploadedFile(
            "receipt.jpg", b"fake-bytes", content_type="image/jpeg"
        )

    def _post(self, extra=None):
        data = {"image": self._image()}
        if extra:
            data.update(extra)
        return self.client.post("/api/receipts/scan/", data, format="multipart")

    @patch("api.views.extract_text", return_value="MAXI\nTOTAL 2340")
    @patch(
        "api.receipts.get_chat_completion",
        return_value=(
            '{"merchant": "Maxi", "date": "2026-07-20", "total": 2340, '
            '"currency": "RSD", "suggested_category": "Groceries", '
            '"confidence": 0.9}'
        ),
    )
    def test_scan_success_matches_category(self, mock_llm, mock_ocr):
        cat = Category.objects.create(
            user=self.user, name="Groceries", type="expense"
        )
        response = self._post()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Maxi")
        self.assertEqual(response.data["amount"], "2340.00")
        self.assertEqual(response.data["date"], "2026-07-20")
        self.assertEqual(response.data["category"], cat.id)
        # OCR text is what the LLM is asked about.
        self.assertEqual(mock_llm.call_args.args[2], "MAXI\nTOTAL 2340")

    @patch("api.views.extract_text", return_value="text")
    @patch(
        "api.receipts.get_chat_completion",
        return_value='{"merchant": "X", "total": 5, '
        '"suggested_category": "groceries"}',
    )
    def test_scan_category_match_case_insensitive(self, mock_llm, mock_ocr):
        cat = Category.objects.create(
            user=self.user, name="Groceries", type="expense"
        )
        response = self._post()
        self.assertEqual(response.data["category"], cat.id)

    @patch("api.views.extract_text", return_value="text")
    @patch(
        "api.receipts.get_chat_completion",
        return_value='{"merchant": "X", "total": 5, '
        '"suggested_category": "Electronics"}',
    )
    def test_scan_unmatched_category_passthrough(self, mock_llm, mock_ocr):
        response = self._post()
        self.assertIsNone(response.data["category"])
        self.assertEqual(response.data["suggested_category"], "Electronics")

    def test_scan_requires_image(self):
        response = self.client.post("/api/receipts/scan/", {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("api.views.extract_text")
    def test_scan_ocr_empty_returns_422(self, mock_ocr):
        from .receipts import ReceiptError

        mock_ocr.side_effect = ReceiptError("No text found in the image.")
        response = self._post()
        self.assertEqual(
            response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY
        )
        self.assertIn("No text", response.data["error"])

    @patch("api.views.extract_text", return_value="text")
    @patch("api.receipts.get_chat_completion", return_value="not json at all")
    def test_scan_bad_json_returns_422(self, mock_llm, mock_ocr):
        response = self._post()
        self.assertEqual(
            response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY
        )

    @patch("api.views.extract_text", return_value="text")
    @patch("api.receipts.get_chat_completion", return_value='{"total": 5}')
    def test_scan_missing_openai_key_400(self, mock_llm, mock_ocr):
        self.user.settings.open_ai_api_key = ""
        self.user.settings.save()
        response = self._post()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_scan_requires_auth(self):
        self.client.force_authenticate(None)
        response = self._post()
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ReceiptUnitTests(APITestCase):
    def test_coerce_total_formats(self):
        from .receipts import _coerce_total

        self.assertEqual(_coerce_total("1.234,56"), Decimal("1234.56"))
        self.assertEqual(_coerce_total("1,234.56"), Decimal("1234.56"))
        self.assertEqual(_coerce_total("€12.30"), Decimal("12.30"))
        self.assertEqual(_coerce_total("12,30"), Decimal("12.30"))
        self.assertEqual(_coerce_total("2340"), Decimal("2340.00"))
        self.assertIsNone(_coerce_total("n/a"))
        self.assertIsNone(_coerce_total(None))

    def test_strip_fences(self):
        from .receipts import _strip_fences

        self.assertEqual(_strip_fences('```json\n{"a": 1}\n```'), '{"a": 1}')
        self.assertEqual(_strip_fences('{"a": 1}'), '{"a": 1}')

    def test_coerce_date_fallback_to_today(self):
        from .receipts import _coerce_date

        self.assertEqual(_coerce_date("2026-07-20"), "2026-07-20")
        self.assertEqual(_coerce_date(""), date.today().isoformat())
        self.assertEqual(_coerce_date("garbage"), date.today().isoformat())

    def test_coerce_date_european_day_first(self):
        from .receipts import _coerce_date

        # DD.MM.YYYY and DD/MM/YY, day-first (Serbian receipts).
        self.assertEqual(_coerce_date("20.07.2026"), "2026-07-20")
        self.assertEqual(_coerce_date("05/03/26"), "2026-03-05")
        self.assertEqual(_coerce_date("Datum: 20.07.2026 14:32"), "2026-07-20")
        # Impossible day-first date falls back rather than guessing.
        self.assertEqual(_coerce_date("13.20.2026"), date.today().isoformat())

    @patch(
        "api.receipts.get_chat_completion",
        return_value='```json\n{"merchant": "Shop", "date": "2026-07-20", '
        '"total": "1.234,56", "currency": "eur", '
        '"suggested_category": "Dining", "confidence": "0.8"}\n```',
    )
    def test_parse_receipt_full(self, mock_llm):
        from .receipts import parse_receipt

        draft = parse_receipt("ocr text", {"any": "resolved"}, ["Dining"])
        self.assertEqual(draft["merchant"], "Shop")
        self.assertEqual(draft["total"], "1234.56")
        self.assertEqual(draft["currency"], "EUR")
        self.assertEqual(draft["suggested_category"], "Dining")
        self.assertEqual(draft["confidence"], 0.8)

    @patch("api.receipts.get_chat_completion", return_value="nonsense")
    def test_parse_receipt_bad_json_raises(self, mock_llm):
        from .receipts import ReceiptError, parse_receipt

        with self.assertRaises(ReceiptError):
            parse_receipt("ocr", {}, [])


class EncryptedKeyTests(APITestCase):
    """The four Settings secrets are encrypted at rest and never echoed back."""

    def setUp(self):
        self.user = create_user("alice")
        self.client.force_authenticate(self.user)

    def _raw_column(self, column):
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT {column} FROM api_settings WHERE user_id = %s",
                [self.user.id],
            )
            return cursor.fetchone()[0]

    def test_crypto_round_trip(self):
        from . import crypto

        token = crypto.encrypt("sk-secret")
        self.assertNotEqual(token, "sk-secret")
        self.assertTrue(crypto.is_encrypted(token))
        self.assertEqual(crypto.decrypt(token), "sk-secret")

    def test_crypto_passthrough_for_empty(self):
        from . import crypto

        self.assertIsNone(crypto.encrypt(None))
        self.assertEqual(crypto.encrypt(""), "")
        self.assertIsNone(crypto.decrypt(None))
        self.assertFalse(crypto.is_encrypted(""))

    def test_crypto_decrypt_legacy_plaintext_passthrough(self):
        from . import crypto

        # A pre-migration plaintext value is returned unchanged, not an error.
        self.assertEqual(crypto.decrypt("sk-legacy-plaintext"), "sk-legacy-plaintext")

    def test_field_round_trip_through_orm(self):
        # Proves llm.resolve_llm / StocksPortfolio still read usable plaintext.
        self.user.settings.open_ai_api_key = "sk-abc123"
        self.user.settings.save()
        reloaded = Settings.objects.get(user=self.user)
        self.assertEqual(reloaded.open_ai_api_key, "sk-abc123")

    def test_api_key_encrypted_at_rest(self):
        self.user.settings.open_ai_api_key = "sk-plainsecret"
        self.user.settings.save()
        raw = self._raw_column("open_ai_api_key")
        self.assertNotEqual(raw, "sk-plainsecret")
        self.assertTrue(raw.startswith("gAAAAA"))  # Fernet token marker

    def test_settings_get_masks_secrets(self):
        self.client.post(
            "/api/settings/",
            {"open_ai_api_key": "sk-x", "t212_api_key": "t-key"},
        )
        get = self.client.get("/api/settings/")
        self.assertNotIn("open_ai_api_key", get.data)
        self.assertNotIn("t212_api_key", get.data)
        self.assertTrue(get.data["has_open_ai_api_key"])
        self.assertTrue(get.data["has_t212_api_key"])
        self.assertFalse(get.data["has_anthropic_api_key"])

    def test_blank_key_preserves_existing(self):
        self.client.post("/api/settings/", {"open_ai_api_key": "sk-keepme"})
        # Save other settings without retyping the key.
        self.client.post(
            "/api/settings/",
            {"open_ai_api_key": "", "llm_model": "gpt-4o"},
        )
        reloaded = Settings.objects.get(user=self.user)
        self.assertEqual(reloaded.open_ai_api_key, "sk-keepme")
        self.assertEqual(reloaded.llm_model, "gpt-4o")

    def test_omitted_key_preserves_existing(self):
        self.client.post("/api/settings/", {"open_ai_api_key": "sk-keepme"})
        self.client.post("/api/settings/", {"llm_model": "gpt-4o"})
        reloaded = Settings.objects.get(user=self.user)
        self.assertEqual(reloaded.open_ai_api_key, "sk-keepme")

    def test_new_key_overwrites(self):
        self.client.post("/api/settings/", {"open_ai_api_key": "sk-old"})
        self.client.post("/api/settings/", {"open_ai_api_key": "sk-new"})
        reloaded = Settings.objects.get(user=self.user)
        self.assertEqual(reloaded.open_ai_api_key, "sk-new")


class VaultUnitTests(APITestCase):
    """Envelope-crypto primitives in api/vault.py."""

    def tearDown(self):
        from . import vault

        vault.clear_current_dek()

    def test_kek_derivation_stable_per_salt(self):
        from . import vault

        salt = vault.new_salt()
        self.assertEqual(
            vault.derive_kek("hunter2", salt), vault.derive_kek("hunter2", salt)
        )

    def test_kek_differs_by_salt_and_password(self):
        from . import vault

        salt_a, salt_b = vault.new_salt(), vault.new_salt()
        self.assertNotEqual(
            vault.derive_kek("hunter2", salt_a),
            vault.derive_kek("hunter2", salt_b),
        )
        self.assertNotEqual(
            vault.derive_kek("hunter2", salt_a),
            vault.derive_kek("other", salt_a),
        )

    def test_wrap_unwrap_round_trip(self):
        from . import vault

        dek = vault.new_dek()
        salt = vault.new_salt()
        kek = vault.derive_kek("pw", salt)
        token = vault.wrap(dek, kek)
        self.assertNotIn(dek.decode(), token)
        self.assertEqual(vault.unwrap(token, kek), dek)

    def test_unwrap_wrong_key_raises(self):
        from cryptography.fernet import InvalidToken

        from . import vault

        dek = vault.new_dek()
        salt = vault.new_salt()
        token = vault.wrap(dek, vault.derive_kek("right", salt))
        with self.assertRaises(InvalidToken):
            vault.unwrap(token, vault.derive_kek("wrong", salt))

    def test_recovery_key_format_round_trip(self):
        from . import vault

        key = vault.new_recovery_key()
        formatted = vault.format_recovery_key(key)
        self.assertIn(" ", formatted)
        self.assertEqual(vault.parse_recovery_key(formatted), key)

    def test_recovery_key_parse_tolerates_whitespace(self):
        from . import vault

        key = vault.new_recovery_key()
        formatted = vault.format_recovery_key(key)
        messy = "  " + formatted.replace(" ", "\n") + "  "
        self.assertEqual(vault.parse_recovery_key(messy), key)


class VaultModelTests(APITestCase):
    """create/unlock/rewrap/recover over a real Vault row."""

    def setUp(self):
        self.user = create_user("alice")

    def tearDown(self):
        from . import vault

        vault.clear_current_dek()
        vault.lock_user(self.user.id)

    def test_create_returns_recovery_and_unlocks(self):
        from . import vault

        recovery = vault.create_vault(self.user, "pw-abc-123")
        self.assertTrue(recovery)
        self.assertTrue(vault.is_unlocked(self.user.id))
        self.assertIsNotNone(vault.get_dek(self.user.id))

    def test_unlock_with_password(self):
        from . import vault

        vault.create_vault(self.user, "pw-abc-123")
        dek = vault.get_dek(self.user.id)
        vault.lock_user(self.user.id)
        self.assertFalse(vault.is_unlocked(self.user.id))
        vault.unlock_with_password(self.user, "pw-abc-123")
        self.assertEqual(vault.get_dek(self.user.id), dek)

    def test_unlock_wrong_password_raises(self):
        from cryptography.fernet import InvalidToken

        from . import vault

        vault.create_vault(self.user, "pw-abc-123")
        vault.lock_user(self.user.id)
        with self.assertRaises(InvalidToken):
            vault.unlock_with_password(self.user, "wrong-pw")

    def test_rewrap_password_keeps_same_dek(self):
        from . import vault

        vault.create_vault(self.user, "old-pw-123")
        dek = vault.get_dek(self.user.id)
        vault.rewrap_password(self.user, "old-pw-123", "new-pw-456")
        vault.lock_user(self.user.id)
        vault.unlock_with_password(self.user, "new-pw-456")
        self.assertEqual(vault.get_dek(self.user.id), dek)

    def test_old_password_fails_after_rewrap(self):
        from cryptography.fernet import InvalidToken

        from . import vault

        vault.create_vault(self.user, "old-pw-123")
        vault.rewrap_password(self.user, "old-pw-123", "new-pw-456")
        vault.lock_user(self.user.id)
        with self.assertRaises(InvalidToken):
            vault.unlock_with_password(self.user, "old-pw-123")

    def test_recover_with_recovery_key_keeps_dek(self):
        from . import vault

        recovery = vault.create_vault(self.user, "old-pw-123")
        dek = vault.get_dek(self.user.id)
        vault.recover(self.user, recovery, "reset-pw-789")
        vault.lock_user(self.user.id)
        vault.unlock_with_password(self.user, "reset-pw-789")
        self.assertEqual(vault.get_dek(self.user.id), dek)

    def test_recovery_key_survives_password_change(self):
        from . import vault

        recovery = vault.create_vault(self.user, "old-pw-123")
        dek = vault.get_dek(self.user.id)
        # Password change re-wraps only the password copy, not the recovery copy.
        vault.rewrap_password(self.user, "old-pw-123", "new-pw-456")
        vault.recover(self.user, recovery, "reset-pw-789")
        self.assertEqual(vault.get_dek(self.user.id), dek)


class VaultFieldTests(APITestCase):
    """With a DEK active, secrets encrypt under the DEK, not the keyfile."""

    def setUp(self):
        self.user = create_user("alice")

    def tearDown(self):
        from . import vault

        vault.clear_current_dek()
        vault.lock_user(self.user.id)

    def _raw_column(self, column):
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT {column} FROM api_settings WHERE user_id = %s",
                [self.user.id],
            )
            return cursor.fetchone()[0]

    def test_secret_encrypted_under_dek_not_keyfile(self):
        from cryptography.fernet import Fernet, InvalidToken

        from . import crypto, vault

        vault.create_vault(self.user, "pw-abc-123")
        dek = vault.get_dek(self.user.id)
        vault.set_current_dek(dek)
        try:
            self.user.settings.open_ai_api_key = "sk-under-dek"
            self.user.settings.save()
        finally:
            vault.clear_current_dek()

        raw = self._raw_column("open_ai_api_key")
        self.assertTrue(raw.startswith("gAAAAA"))
        # The keyfile can no longer read it — only the DEK can.
        with self.assertRaises(InvalidToken):
            crypto.keyfile_fernet().decrypt(raw.encode())
        self.assertEqual(
            Fernet(dek).decrypt(raw.encode()).decode(), "sk-under-dek"
        )


class VaultLazyMigrationTests(APITestCase):
    """First login re-encrypts a keyfile secret to the DEK, no data loss."""

    def setUp(self):
        self.user = create_user("alice")

    def tearDown(self):
        from . import vault

        vault.clear_current_dek()
        vault.lock_user(self.user.id)

    def _raw_column(self, column):
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT {column} FROM api_settings WHERE user_id = %s",
                [self.user.id],
            )
            return cursor.fetchone()[0]

    def test_first_login_migrates_keyfile_secret_to_dek(self):
        from cryptography.fernet import Fernet, InvalidToken

        from . import crypto, vault

        # Seed a keyfile-encrypted secret (no DEK active — today's behaviour).
        self.user.settings.open_ai_api_key = "sk-legacy"
        self.user.settings.save()
        raw_before = self._raw_column("open_ai_api_key")
        self.assertEqual(crypto.keyfile_fernet().decrypt(raw_before.encode()).decode(), "sk-legacy")

        # First login under the vault code: creates the vault and migrates.
        recovery = vault.ensure_unlocked(self.user, "test-pass-123")
        self.assertTrue(recovery)  # freshly created -> recovery key returned

        raw_after = self._raw_column("open_ai_api_key")
        dek = vault.get_dek(self.user.id)
        with self.assertRaises(InvalidToken):
            crypto.keyfile_fernet().decrypt(raw_after.encode())
        self.assertEqual(Fernet(dek).decrypt(raw_after.encode()).decode(), "sk-legacy")


@override_settings(DESKTOP_MODE=True)
class VaultApiTests(APITestCase):
    """Registration, login-unlock, vault state, recover, and change-password.

    The vault is a desktop feature, so these run with DESKTOP_MODE forced on.
    """

    def setUp(self):
        # /api/token/ and /api/vault/recover/ are throttled; clear the shared
        # LocMem throttle bucket so per-method login bursts don't accumulate.
        cache.clear()

    def tearDown(self):
        from . import vault

        vault.clear_current_dek()

    def _login(self, username, password):
        resp = self.client.post(
            "/api/token/", {"username": username, "password": password}
        )
        return resp

    def _auth(self, access):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    def test_register_returns_recovery_key(self):
        resp = self.client.post(
            "/api/user/register/", {"username": "bob", "password": "pw-abc-123"}
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn("recovery_key", resp.data)
        self.assertTrue(resp.data["recovery_key"])

    def test_login_unlocks_registered_account_without_recovery_key(self):
        from . import vault

        self.client.post(
            "/api/user/register/", {"username": "bob", "password": "pw-abc-123"}
        )
        user = User.objects.get(username="bob")
        vault.lock_user(user.id)  # simulate a fresh sidecar

        resp = self._login("bob", "pw-abc-123")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Vault already existed (made at registration) -> no recovery key echoed.
        self.assertNotIn("recovery_key", resp.data)
        self.assertTrue(vault.is_unlocked(user.id))

    def test_vault_state_reflects_unlock(self):
        from . import vault

        self.client.post(
            "/api/user/register/", {"username": "bob", "password": "pw-abc-123"}
        )
        user = User.objects.get(username="bob")
        resp = self._login("bob", "pw-abc-123")
        self._auth(resp.data["access"])

        state = self.client.get("/api/vault/state/")
        self.assertTrue(state.data["unlocked"])

        vault.lock_user(user.id)
        state = self.client.get("/api/vault/state/")
        self.assertFalse(state.data["unlocked"])

    @override_settings(DESKTOP_MODE=False)
    def test_accounts_list_404_in_web_mode(self):
        create_user("bob")
        resp = self.client.get("/api/accounts/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_accounts_list_desktop_mode(self):
        create_user("carol")
        create_user("dave")
        resp = self.client.get("/api/accounts/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        usernames = [row["username"] for row in resp.data]
        self.assertEqual(usernames, ["carol", "dave"])

    def test_recover_resets_password_without_data_loss(self):
        from cryptography.fernet import Fernet

        from . import vault

        reg = self.client.post(
            "/api/user/register/", {"username": "bob", "password": "pw-abc-123"}
        )
        recovery = reg.data["recovery_key"]
        user = User.objects.get(username="bob")

        login = self._login("bob", "pw-abc-123")
        self._auth(login.data["access"])
        self.client.post("/api/settings/", {"open_ai_api_key": "sk-orig"})

        resp = self.client.post(
            "/api/vault/recover/",
            {
                "username": "bob",
                "recovery_key": recovery,
                "new_password": "reset-pw-789",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # Old password no longer works; new one does.
        self.assertEqual(self._login("bob", "pw-abc-123").status_code, 401)
        self.assertEqual(self._login("bob", "reset-pw-789").status_code, 200)

        # The secret set before recovery is still intact under the same DEK.
        dek = vault.get_dek(user.id)
        vault.set_current_dek(dek)
        try:
            self.assertEqual(
                Settings.objects.get(user=user).open_ai_api_key, "sk-orig"
            )
        finally:
            vault.clear_current_dek()

    def test_recover_wrong_key_rejected(self):
        from . import vault

        reg = self.client.post(
            "/api/user/register/", {"username": "bob", "password": "pw-abc-123"}
        )
        bad = vault.format_recovery_key(vault.new_recovery_key())
        resp = self.client.post(
            "/api/vault/recover/",
            {"username": "bob", "recovery_key": bad, "new_password": "reset-pw-789"},
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        # Original password still works (nothing changed).
        self.assertEqual(self._login("bob", "pw-abc-123").status_code, 200)

    def test_change_password_rewraps_and_keeps_secret(self):
        from cryptography.fernet import Fernet

        from . import vault

        self.client.post(
            "/api/user/register/", {"username": "bob", "password": "old-pw-123"}
        )
        user = User.objects.get(username="bob")
        login = self._login("bob", "old-pw-123")
        self._auth(login.data["access"])
        self.client.post("/api/settings/", {"open_ai_api_key": "sk-orig"})

        resp = self.client.post(
            "/api/user/change-password/",
            {"old_password": "old-pw-123", "new_password": "new-pw-456xyz"},
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        vault.lock_user(user.id)
        self.assertEqual(self._login("bob", "new-pw-456xyz").status_code, 200)
        dek = vault.get_dek(user.id)
        vault.set_current_dek(dek)
        try:
            self.assertEqual(
                Settings.objects.get(user=user).open_ai_api_key, "sk-orig"
            )
        finally:
            vault.clear_current_dek()
