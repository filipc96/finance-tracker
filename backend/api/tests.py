from decimal import Decimal

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Account, Category, Settings, Transaction


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
