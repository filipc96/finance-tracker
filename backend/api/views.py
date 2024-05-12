from django.shortcuts import render
from django.contrib.auth.models import User
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .serializers import UserSerializer, TransactionSerializer, CategorySerializer
from .models import Transaction, Category
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Sum
from django.db.models.functions import TruncMonth


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
    permission_classes = [AllowAny]

    def get(self, request, year):
        filtered = Transaction.objects.filter(date__year=year)

        monthly_sums = (
            filtered.annotate(month=TruncMonth("date"))
            .values("month")
            .order_by("month")
            .annotate(sum_of_transactions=Sum("amount"))
        )
        monthly = {i: 0 for i in range(1, 13)}

        for m in monthly_sums:
            month_number = m.get("month").month
            monthly[month_number] = m.get("sum_of_transactions")
        return Response(monthly)
