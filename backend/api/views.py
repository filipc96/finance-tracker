import csv
import io
from decimal import Decimal, InvalidOperation

from django.http import HttpResponse
from django.shortcuts import render
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser
from .serializers import (
    BudgetSerializer,
    CategorySerializer,
    RecurringTransactionSerializer,
    SettingsSerializer,
    TransactionSerializer,
    UserSerializer,
)
from .models import Budget, RecurringTransaction, Transaction, Category
from .services import process_recurring
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Q, Sum, Value
from django.db.models.functions import TruncMonth, TruncYear, Coalesce
from datetime import datetime, timedelta
from openai import OpenAI, OpenAIError, AuthenticationError, RateLimitError


class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]


class GetLatestExpense(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            latest_expense = Transaction.objects.filter(
                user=request.user, type="expense"
            ).latest("date_created")
            serializer = TransactionSerializer(latest_expense)
            return Response(serializer.data)
        except Transaction.DoesNotExist:
            return Response(False)


class GetLatestIncome(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            latest_income = Transaction.objects.filter(
                user=request.user, type="income"
            ).latest("date_created")
            serializer = TransactionSerializer(latest_income)
            return Response(serializer.data)
        except Transaction.DoesNotExist:
            return Response(False)


class GetUser(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        username = request.user.username
        balance = request.user.account.balance
        return Response(
            {
                "username": username,
                "balance": balance,
                "date_joined": request.user.date_joined.date(),
            }
        )


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get("old_password", "")
        new_password = request.data.get("new_password", "")

        if not request.user.check_password(old_password):
            return Response(
                {"error": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user=request.user)
        except ValidationError as e:
            return Response(
                {"error": " ".join(e.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(new_password)
        request.user.save()
        return Response({"detail": "Password changed successfully."})


class SettingsListCreate(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SettingsSerializer

    def get(self, request):
        dark_mode = request.user.settings.dark_mode
        open_ai_api_key = request.user.settings.open_ai_api_key
        return Response({
            "dark_mode": dark_mode,
            "open_ai_api_key": open_ai_api_key
        })
    
    def post(self, request):
        settings = request.user.settings
        serializer = SettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TransactionPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class TransactionListCreate(generics.ListCreateAPIView):

    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = TransactionPagination

    def get_queryset(self):
        user = self.request.user
        return Transaction.objects.filter(user=user).order_by("-date", "-id")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TransactionDelete(generics.DestroyAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Transaction.objects.filter(user=user, id=self.kwargs["pk"])


class CategoryListCreate(generics.ListCreateAPIView):

    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Category.objects.filter(user=user).annotate(
            transactions_sum=Coalesce(
                Sum("transaction__amount"), Value(Decimal("0.00"))
            )
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CategoryDelete(generics.DestroyAPIView):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Category.objects.filter(user=user, id=self.kwargs["pk"])


class GetMonthlyTransactionSum(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, year, transaction_type):
        filtered = Transaction.objects.filter(
            user=request.user, date__year=year, type=transaction_type
        )

        monthly_sums = (
            filtered.annotate(month=TruncMonth("date"))
            .values("month")
            .order_by("month")
            .annotate(sum_of_transactions=Sum("amount"))
        )
        monthly = [0] * 12

        for m in monthly_sums:
            month_number = m.get("month").month
            monthly[month_number - 1] = m.get("sum_of_transactions")
        return Response(monthly)


class GetYearlyTransactionSum(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, transaction_type):
        filtered = Transaction.objects.filter(
            user=request.user, type=transaction_type
        )

        yearly_sums = (
            filtered.annotate(year=TruncYear("date"))
            .values("year")
            .order_by("year")
            .annotate(sum_of_transactions=Sum("amount"))
        )

        yearly_sum_response = {}

        for m in yearly_sums:
            year = m.get("year").year
            yearly_sum_response[year] = m.get("sum_of_transactions")
        return Response(yearly_sum_response)


class GetAllTimeTransactionSum(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, transaction_type):
        filtered = Transaction.objects.filter(
            user=request.user, type=transaction_type
        )

        return Response(filtered.aggregate(total_sum=Sum("amount"))["total_sum"])


def budget_month_bounds(month):
    """(first day of month, first day of next month) for a normalized month."""
    if month.month == 12:
        return month, month.replace(year=month.year + 1, month=1)
    return month, month.replace(month=month.month + 1)


class BudgetListCreate(generics.ListCreateAPIView):
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated]

    def get_month(self):
        month_param = self.request.query_params.get("month")
        if month_param:
            try:
                return datetime.strptime(month_param, "%Y-%m").date()
            except ValueError:
                pass
        return datetime.now().date().replace(day=1)

    def get_queryset(self):
        user = self.request.user
        month = self.get_month()
        start, end = budget_month_bounds(month)
        return (
            Budget.objects.filter(user=user, month=month)
            .select_related("category")
            .annotate(
                spent=Coalesce(
                    Sum(
                        "category__transaction__amount",
                        filter=Q(
                            category__transaction__user=user,
                            category__transaction__date__gte=start,
                            category__transaction__date__lt=end,
                        ),
                    ),
                    Value(Decimal("0.00")),
                )
            )
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class BudgetDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Budget.objects.filter(user=self.request.user)


CSV_COLUMNS = ["date", "name", "amount", "type", "category"]
CSV_IMPORT_MAX_ROWS = 5000


class ExportTransactionsCSV(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="transactions.csv"'

        writer = csv.writer(response)
        writer.writerow(CSV_COLUMNS)
        transactions = (
            Transaction.objects.filter(user=request.user)
            .select_related("category")
            .order_by("date", "id")
        )
        for t in transactions:
            writer.writerow([t.date, t.name, t.amount, t.type, t.category.name])
        return response


class ImportTransactionsCSV(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response(
                {"error": "No file uploaded."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            decoded = upload.read().decode("utf-8-sig")
        except UnicodeDecodeError:
            return Response(
                {"error": "File must be UTF-8 encoded CSV."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reader = csv.DictReader(io.StringIO(decoded))
        missing = set(CSV_COLUMNS) - set(reader.fieldnames or [])
        if missing:
            return Response(
                {"error": f"Missing columns: {', '.join(sorted(missing))}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = 0
        errors = []
        for row_number, row in enumerate(reader, start=2):
            if created + len(errors) >= CSV_IMPORT_MAX_ROWS:
                errors.append(
                    {
                        "row": row_number,
                        "error": f"Import capped at {CSV_IMPORT_MAX_ROWS} rows.",
                    }
                )
                break
            try:
                tx_date = datetime.strptime(
                    (row.get("date") or "").strip(), "%Y-%m-%d"
                ).date()
                amount = Decimal((row.get("amount") or "").strip())
                if amount <= 0:
                    raise ValueError("amount must be positive")
                tx_type = (row.get("type") or "").strip().lower()
                if tx_type not in ["expense", "income"]:
                    raise ValueError("type must be expense or income")
                name = (row.get("name") or "").strip()
                category_name = (row.get("category") or "").strip()
                if not name or not category_name:
                    raise ValueError("name and category are required")
            except (ValueError, InvalidOperation) as e:
                errors.append({"row": row_number, "error": str(e)})
                continue

            category, _ = Category.objects.get_or_create(
                user=request.user, name=category_name, type=tx_type
            )
            # Individual creates so balance signals fire
            Transaction.objects.create(
                user=request.user,
                date=tx_date,
                amount=amount,
                name=name,
                category=category,
                type=tx_type,
            )
            created += 1

        return Response({"created": created, "errors": errors})


class RecurringListCreate(generics.ListCreateAPIView):
    serializer_class = RecurringTransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return RecurringTransaction.objects.filter(
            user=self.request.user
        ).select_related("category")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class RecurringDelete(generics.DestroyAPIView):
    serializer_class = RecurringTransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return RecurringTransaction.objects.filter(user=self.request.user)


class ProcessOnLoad(APIView):
    """Client-triggered processing hook called by the frontend on app load."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        created = process_recurring(request.user)
        return Response({"recurring_created": created})


def build_financial_context(user):
    """Plain-text summary of the user's finances for the chat system prompt."""
    balance = user.account.balance
    today = datetime.now().date()

    recent = (
        Transaction.objects.filter(user=user)
        .select_related("category")
        .order_by("-date", "-id")[:20]
    )
    recent_lines = [
        f"- {t.date} | {t.type} | {t.category.name} | {t.name} | {t.amount}"
        for t in recent
    ]

    category_sums = Category.objects.filter(user=user).annotate(
        total=Coalesce(Sum("transaction__amount"), Value(Decimal("0.00")))
    )
    category_lines = [
        f"- {c.name} ({c.type}): {c.total}" for c in category_sums
    ]

    totals = {
        row["type"]: row["total"]
        for row in Transaction.objects.filter(user=user)
        .values("type")
        .annotate(total=Sum("amount"))
    }

    return "\n".join(
        [
            f"Today's date: {today}",
            f"Account balance: {balance}",
            f"All-time income: {totals.get('income', Decimal('0.00'))}",
            f"All-time expenses: {totals.get('expense', Decimal('0.00'))}",
            "",
            "Sums by category:",
            *(category_lines or ["- (no categories yet)"]),
            "",
            "Most recent transactions (date | type | category | name | amount):",
            *(recent_lines or ["- (no transactions yet)"]),
        ]
    )


class ChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = (request.data.get("message") or "").strip()
        if not message:
            return Response(
                {"error": "Message is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        api_key = request.user.settings.open_ai_api_key
        if not api_key:
            return Response(
                {
                    "error": "No OpenAI API key configured. "
                    "Add one on the Settings page."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        system_prompt = (
            "You are a helpful personal finance assistant inside a "
            "finance-tracker app. Answer concisely using the user's "
            "financial data below. If asked something unrelated to "
            "personal finance, politely steer back to finances.\n\n"
            + build_financial_context(request.user)
        )

        try:
            client = OpenAI(api_key=api_key, timeout=30)
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message},
                ],
                max_tokens=500,
            )
            return Response({"response": completion.choices[0].message.content})
        except AuthenticationError:
            return Response(
                {"error": "Invalid OpenAI API key."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except RateLimitError:
            return Response(
                {"error": "OpenAI rate limit reached. Try again shortly."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        except OpenAIError:
            return Response(
                {"error": "Failed to reach OpenAI. Try again later."},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class GetTransactionsByTimespan(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, timespan, transaction_type):
        if timespan not in [6, 12, 24]:
            return Response(
            {
                "error": "Invalid timespan. Use 6, 12, or 24 (months)."},
                status=400,
            )

        if transaction_type not in ["expense", "income"]:
            return Response(
            {
                "error": "Invalid transaction type. Use 'expense' or 'income'."},
                status=400,
            )

        end_date = datetime.now()
        start_date = end_date - timedelta(days=timespan * 30)  
        transactions = Transaction.objects.filter(
            user=request.user,
            type=transaction_type,
            date__range=[start_date, end_date],
        )

        grouped_data = (
            transactions.annotate(month=TruncMonth("date"))
            .values("month")
            .order_by("month")
            .annotate(total=Sum("amount"))
        )
        result = [
            {"month": item["month"].strftime("%Y-%m"), "total": item["total"]}
            for item in grouped_data
        ]

        return Response(result)
