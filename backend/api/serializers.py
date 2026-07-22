from django.contrib.auth.models import User
from rest_framework import serializers
from .models import (
    Budget,
    Category,
    RecurringTransaction,
    SavingsAccount,
    SavingsTransaction,
    Settings,
    Transaction,
)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "password"]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user
class SettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Settings
        fields = [
            "dark_mode",
            "open_ai_api_key",
            "t212_api_key",
            "t212_api_secret",
            "t212_environment",
        ]
        extra_kwargs = {"user": {"read_only": True}}

class CategorySerializer(serializers.ModelSerializer):
    transactions_sum = serializers.DecimalField(
        read_only=True, max_digits=20, decimal_places=2
    )

    class Meta:
        model = Category
        fields = ["id", "name", "type", "transactions_sum"]
        extra_kwargs = {"user": {"read_only": True}}


class BudgetSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    spent = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True
    )

    class Meta:
        model = Budget
        fields = ["id", "category", "category_name", "amount", "month", "spent"]
        extra_kwargs = {"user": {"read_only": True}}

    def validate_category(self, category):
        request = self.context["request"]
        if category.user != request.user:
            raise serializers.ValidationError("Category not found.")
        if category.type != "expense":
            raise serializers.ValidationError(
                "Budgets can only be set for expense categories."
            )
        return category

    def validate_month(self, month):
        return month.replace(day=1)

    def validate(self, attrs):
        request = self.context["request"]
        category = attrs.get("category") or (self.instance and self.instance.category)
        month = attrs.get("month") or (self.instance and self.instance.month)
        existing = Budget.objects.filter(
            user=request.user, category=category, month=month
        )
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError(
                "A budget for this category and month already exists."
            )
        return attrs


class RecurringTransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = RecurringTransaction
        fields = [
            "id",
            "name",
            "amount",
            "category",
            "category_name",
            "type",
            "frequency",
            "next_due",
            "active",
        ]
        extra_kwargs = {"user": {"read_only": True}}

    def validate_category(self, category):
        if category.user != self.context["request"].user:
            raise serializers.ValidationError("Category not found.")
        return category

    def validate_amount(self, amount):
        if amount <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return amount

    def validate(self, attrs):
        category = attrs.get("category") or (self.instance and self.instance.category)
        type_ = attrs.get("type") or (self.instance and self.instance.type)
        if category and type_ and category.type != type_:
            raise serializers.ValidationError(
                "Transaction type must match the category type."
            )
        return attrs


class SavingsAccountSerializer(serializers.ModelSerializer):
    starting_balance = serializers.DecimalField(
        max_digits=12, decimal_places=2, write_only=True, required=False
    )

    class Meta:
        model = SavingsAccount
        fields = [
            "id",
            "name",
            "balance",
            "apy_rate",
            "active",
            "last_interest_date",
            "starting_balance",
        ]
        read_only_fields = ["balance", "last_interest_date"]
        extra_kwargs = {"user": {"read_only": True}}

    def validate_apy_rate(self, apy_rate):
        if apy_rate < 0:
            raise serializers.ValidationError("APY rate cannot be negative.")
        return apy_rate

    def validate_starting_balance(self, starting_balance):
        if starting_balance < 0:
            raise serializers.ValidationError(
                "Starting balance cannot be negative."
            )
        return starting_balance


class SavingsTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavingsTransaction
        fields = ["id", "type", "amount", "balance_after", "date"]
        read_only_fields = ["balance_after"]
        extra_kwargs = {"date": {"required": False}}

    def validate_type(self, type_):
        if type_ == "interest":
            raise serializers.ValidationError(
                "Interest entries are posted automatically."
            )
        return type_

    def validate_amount(self, amount):
        if amount <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return amount


class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(required=False, source="category.name")

    class Meta:
        model = Transaction
        fields = ["id", "date", "amount", "name", "category_name", "category", "type"]
        extra_kwargs = {"user": {"read_only": True}}
