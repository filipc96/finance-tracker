from django.contrib.auth.models import User
from rest_framework import serializers

from . import vault
from .fx import BASE_CURRENCY, SUPPORTED_CURRENCIES, FxError, to_base
from .models import (
    Budget,
    Category,
    RecurringTransaction,
    SavingsAccount,
    SavingsTransaction,
    Settings,
    Transaction,
)


def _validate_currency(code, *, allow_blank=False):
    """Normalize and validate an ISO 4217 code against the supported set."""
    if not code:
        if allow_blank:
            return ""
        raise serializers.ValidationError("A currency is required.")
    code = str(code).upper()
    if code not in SUPPORTED_CURRENCIES:
        raise serializers.ValidationError(f"Unsupported currency: {code}.")
    return code


class UserSerializer(serializers.ModelSerializer):
    # Returned exactly once, in the registration response, so the client can
    # show the recovery key. Never stored, never echoed again.
    recovery_key = serializers.CharField(read_only=True)
    # The account's base currency, chosen once here and then locked. Not a User
    # field — applied to the auto-created Settings row in create().
    base_currency = serializers.CharField(
        write_only=True, required=False, default=BASE_CURRENCY
    )

    class Meta:
        model = User
        fields = ["id", "username", "password", "recovery_key", "base_currency"]
        extra_kwargs = {"password": {"write_only": True}}

    def validate_base_currency(self, value):
        return _validate_currency(value)

    def validate(self, attrs):
        # Enforce AUTH_PASSWORD_VALIDATORS at registration (change-password and
        # recover already do — see views.py). The password also derives the
        # vault KEK, so a weak one directly weakens the at-rest encryption.
        # Validate against an unsaved User so UserAttributeSimilarityValidator
        # can compare against the chosen username. Errors are re-raised under
        # the "password" key so the frontend surfaces them (Form.jsx).
        from django.contrib.auth.password_validation import (
            validate_password as dj_validate_password,
        )
        from django.core.exceptions import ValidationError as DjangoValidationError

        try:
            dj_validate_password(
                attrs.get("password"), user=User(username=attrs.get("username"))
            )
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        return attrs

    def create(self, validated_data):
        from django.conf import settings as django_settings

        # base_currency is a Settings field, not a User field — pull it out
        # before create_user. It's locked after this, so we set it exactly once.
        base_currency = validated_data.pop("base_currency", BASE_CURRENCY)
        password = validated_data["password"]
        user = User.objects.create_user(**validated_data)
        # Settings is auto-created by a post_save signal on User; stamp the
        # chosen base onto it. display_currency stays blank (== follow base).
        Settings.objects.filter(user=user).update(base_currency=base_currency)
        user.recovery_key = None
        # Desktop only: build the account's vault from the registration password
        # so its secrets are protected by that password from the first login.
        # In web/dev mode there is no vault (keyfile encryption, as before).
        if getattr(django_settings, "DESKTOP_MODE", False):
            user.recovery_key = vault.create_vault(user, password)
        return user
class SettingsSerializer(serializers.ModelSerializer):
    # Secrets are write-only — never echoed back to the client. The client
    # instead reads the has_* booleans below to know whether a key is set.
    SECRET_FIELDS = (
        "open_ai_api_key",
        "anthropic_api_key",
        "t212_api_key",
        "t212_api_secret",
    )

    has_open_ai_api_key = serializers.SerializerMethodField()
    has_anthropic_api_key = serializers.SerializerMethodField()
    has_t212_api_key = serializers.SerializerMethodField()
    has_t212_api_secret = serializers.SerializerMethodField()

    class Meta:
        model = Settings
        fields = [
            "dark_mode",
            "base_currency",
            "display_currency",
            "language",
            "open_ai_api_key",
            "anthropic_api_key",
            "ollama_base_url",
            "lmstudio_base_url",
            "llm_provider",
            "llm_model",
            "t212_api_key",
            "t212_api_secret",
            "t212_environment",
            "telegram_enabled",
            "telegram_bot_token",
            "telegram_allowed_user_id",
            "has_open_ai_api_key",
            "has_anthropic_api_key",
            "has_t212_api_key",
            "has_t212_api_secret",
        ]
        extra_kwargs = {
            "user": {"read_only": True},
            # Base is chosen once at registration and locked — echo it back but
            # never let a settings write change it (the accounting currency of
            # every stored amount can't move under the data).
            "base_currency": {"read_only": True},
            "open_ai_api_key": {"write_only": True},
            "anthropic_api_key": {"write_only": True},
            "t212_api_key": {"write_only": True},
            "t212_api_secret": {"write_only": True},
        }

    def validate_display_currency(self, value):
        # Blank is allowed and means "present amounts in the base currency".
        return _validate_currency(value, allow_blank=True)

    def get_has_open_ai_api_key(self, obj):
        return bool(obj.open_ai_api_key)

    def get_has_anthropic_api_key(self, obj):
        return bool(obj.anthropic_api_key)

    def get_has_t212_api_key(self, obj):
        return bool(obj.t212_api_key)

    def get_has_t212_api_secret(self, obj):
        return bool(obj.t212_api_secret)

    def update(self, instance, validated_data):
        # A blank secret means "leave the stored value unchanged" — this is
        # what lets the client omit keys the user didn't retype without wiping
        # them. An explicit non-empty value overwrites.
        for field in self.SECRET_FIELDS:
            if field in validated_data and validated_data[field] in (None, ""):
                validated_data.pop(field)
        return super().update(instance, validated_data)

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
            "currency",
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

    def validate_currency(self, value):
        # The currency `amount` is quoted in. Blank == base; converted to base
        # when the rule fires (services.process_recurring).
        return _validate_currency(value, allow_blank=True)

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
    # Display-only: the write path sets `category` (a PK). Keeping this writable
    # let a dotted-source write leak into the nested category — a latent bug.
    category_name = serializers.CharField(source="category.name", read_only=True)
    # Entry currency: the currency the user typed `amount` in. Write-only and
    # never stored — the amount is converted into the account's base here and
    # only the base value is persisted, so the ledger (and balance) stay purely
    # in base. Blank == amount is already in base.
    currency = serializers.CharField(write_only=True, required=False, default="")

    class Meta:
        model = Transaction
        fields = ["id", "date", "amount", "name", "category_name", "category", "type", "currency"]
        extra_kwargs = {"user": {"read_only": True}}

    def validate_category(self, category):
        if category.user != self.context["request"].user:
            raise serializers.ValidationError("Category not found.")
        return category

    def validate_amount(self, amount):
        if amount <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return amount

    def validate_currency(self, value):
        return _validate_currency(value, allow_blank=True)

    def _apply_entry_currency(self, validated_data):
        """Convert `amount` from the entry currency into the account's base.

        Pops the non-model `currency` key and, when it differs from base,
        rewrites `amount` to its base equivalent at today's rate. A blank entry
        currency (or one equal to base) leaves the amount untouched.
        """
        entry_currency = validated_data.pop("currency", "")
        if "amount" not in validated_data:
            return validated_data
        base = self.context["request"].user.settings.base_currency or BASE_CURRENCY
        entry_currency = entry_currency or base
        if entry_currency != base:
            try:
                validated_data["amount"], _ = to_base(
                    validated_data["amount"], entry_currency, base
                )
            except FxError as e:
                raise serializers.ValidationError({"currency": str(e)})
        return validated_data

    def create(self, validated_data):
        return super().create(self._apply_entry_currency(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._apply_entry_currency(validated_data))
