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
    RecurringTransaction,
    Settings,
    Transaction,
)


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


class ChatTests(APITestCase):
    def setUp(self):
        self.user = create_user("alice")
        self.client.force_authenticate(self.user)
        self.user.settings.open_ai_api_key = "sk-test"
        self.user.settings.save()

    def _mock_completion(self, mock_openai, content="Here is your answer."):
        completion = MagicMock()
        completion.choices = [MagicMock(message=MagicMock(content=content))]
        mock_openai.return_value.chat.completions.create.return_value = (
            completion
        )
        return mock_openai.return_value.chat.completions.create

    @patch("api.views.OpenAI")
    def test_chat_success(self, mock_openai):
        self._mock_completion(mock_openai)
        response = self.client.post("/api/chat/", {"message": "How am I doing?"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["response"], "Here is your answer.")

    @patch("api.views.OpenAI")
    def test_chat_context_includes_transactions(self, mock_openai):
        cat = Category.objects.create(user=self.user, name="Food", type="expense")
        create_transaction(self.user, cat, "42.00", name="groceries-run")
        create_call = self._mock_completion(mock_openai)

        self.client.post("/api/chat/", {"message": "What did I buy?"})

        system_prompt = create_call.call_args.kwargs["messages"][0]["content"]
        self.assertIn("groceries-run", system_prompt)
        self.assertIn("Food", system_prompt)

    def test_chat_requires_message(self):
        response = self.client.post("/api/chat/", {"message": "  "})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_chat_requires_api_key(self):
        self.user.settings.open_ai_api_key = ""
        self.user.settings.save()
        response = self.client.post("/api/chat/", {"message": "hi"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Settings page", response.data["error"])

    def test_chat_requires_auth(self):
        self.client.force_authenticate(None)
        response = self.client.post("/api/chat/", {"message": "hi"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


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
