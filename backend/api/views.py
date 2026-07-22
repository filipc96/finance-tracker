from decimal import Decimal

from django.shortcuts import render
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from .serializers import SettingsSerializer, UserSerializer, TransactionSerializer, CategorySerializer
from .models import Transaction, Category
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Sum, Value
from django.db.models.functions import TruncMonth, TruncYear, Coalesce
from datetime import datetime, timedelta


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
