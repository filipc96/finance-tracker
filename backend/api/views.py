from django.shortcuts import render
from django.contrib.auth.models import User
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .serializers import UserSerializer, TransactionSerializer, CategorySerializer
from .models import Transaction, Category
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Sum
from django.db.models.functions import TruncMonth, TruncYear


# Create your views here.
class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]


class GetLatestExpense(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            latest_expense = Transaction.objects.filter(type="expense").latest(
                "date_created"
            )
            serializer = TransactionSerializer(latest_expense)
            return Response(serializer.data)
        except Transaction.DoesNotExist:
            return Response(False)


class GetLatestIncome(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            latest_income = Transaction.objects.filter(type="income").latest(
                "date_created"
            )
            serializer = TransactionSerializer(latest_income)
            return Response(serializer.data)
        except Transaction.DoesNotExist:
            return Response(False)


class GetUser(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        username = request.user.username
        balance = request.user.account.balance
        return Response({"username": username, "balance": balance})


class TransactionListCreate(generics.ListCreateAPIView):

    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Transaction.objects.filter(user=user)

    def perform_create(self, serializer):
        if serializer.is_valid():
            serializer.save(user=self.request.user)
        else:
            print(serializer.errors)


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
        return Category.objects.filter(user=user)

    def perform_create(self, serializer):
        if serializer.is_valid():
            serializer.save(user=self.request.user)
        else:
            print(serializer.errors)


class CategoryDelete(generics.DestroyAPIView):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Category.objects.filter(user=user, id=self.kwargs["pk"])


class GetMonthlyTransactionSum(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, year, transaction_type):
        filtered = Transaction.objects.filter(date__year=year).filter(
            type=transaction_type
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
    permission_classes = [AllowAny]

    def get(self, request, transaction_type):
        filtered = Transaction.objects.filter(type=transaction_type)

        yearly_sums = (
            filtered.annotate(year=TruncYear("date"))
            .values("year")
            .order_by("year")
            .annotate(sum_of_transactions=Sum("amount"))
        )
        print(yearly_sums)

        yearly_sum_response = {}

        for m in yearly_sums:
            year = m.get("year").year
            yearly_sum_response[year] = m.get("sum_of_transactions")
        return Response(yearly_sum_response)


class GetAllTimeTransactionSum(APIView):
    permission_classes = [AllowAny]

    def get(self, request, transaction_type):
        filtered = Transaction.objects.filter(type=transaction_type)

        return Response(filtered.aggregate(total_sum=Sum("amount"))["total_sum"])


class GetExpensesByTime(APIView):
    permission_classes = [AllowAny]

    def get(self, request, time_period):
        """
        Retrieve expenses grouped by the specified time period (year or month).
        :param time_period: 'year' or 'month'
        """
        if time_period not in ["year", "month"]:
            return Response(
                {"error": "Invalid time period. Use 'year' or 'month'."},
                status=400,
            )

        # Filter expenses
        expenses = Transaction.objects.filter(type="expense")

        # Group by year or month
        if time_period == "year":
            grouped_data = (
                expenses.annotate(year=TruncYear("date"))
                .values("year")
                .order_by("year")
                .annotate(total=Sum("amount"))
            )
            result = [
                {"year": item["year"].year, "total": item["total"]} for item in grouped_data
            ]
        elif time_period == "month":
            grouped_data = (
                expenses.annotate(month=TruncMonth("date"))
                .values("month")
                .order_by("month")
                .annotate(total=Sum("amount"))
            )
            result = [
                {"month": item["month"].strftime("%Y-%m"), "total": item["total"]}
                for item in grouped_data
            ]

        return Response(result)
