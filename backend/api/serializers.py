from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Category, Transaction, Settings


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
        fields = ["dark_mode", "open_ai_api_key"]
        extra_kwargs = {"user": {"read_only": True}}

class CategorySerializer(serializers.ModelSerializer):
    transactions_sum = serializers.DecimalField(
        required=False, max_digits=20, decimal_places=2
    )

    class Meta:
        model = Category
        fields = ["id", "name", "type", "transactions_sum"]
        extra_kwargs = {"user": {"read_only": True}}


class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(required=False, source="category.name")

    class Meta:
        model = Transaction
        fields = ["id", "date", "amount", "name", "category_name", "category", "type"]
        extra_kwargs = {"user": {"read_only": True}}
