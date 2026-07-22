from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Budget, Category, RecurringTransaction, Transaction, Settings


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


class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(required=False, source="category.name")

    class Meta:
        model = Transaction
        fields = ["id", "date", "amount", "name", "category_name", "category", "type"]
        extra_kwargs = {"user": {"read_only": True}}
