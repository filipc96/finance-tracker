from django.db import models
from decimal import Decimal

from django.contrib.auth.models import User
from django.dispatch import receiver
from django.db.models.signals import pre_save, post_save, post_delete

from .fields import EncryptedCharField


class Account(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    balance = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00")
    )

    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.user.username


@receiver(post_save, sender=User)
def create_user_account(sender, instance, created, **kwargs):
    if created:
        Account.objects.create(user=instance)


class Settings(models.Model):
    T212_ENVIRONMENT_CHOICES = [
        ("live", "Live"),
        ("demo", "Demo"),
    ]
    LLM_PROVIDER_CHOICES = [
        ("openai", "OpenAI"),
        ("anthropic", "Anthropic"),
        ("ollama", "Ollama"),
        ("lmstudio", "LM Studio"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    dark_mode = models.BooleanField(default=False)
    # ISO 4217 code the account is denominated in. Chosen once at registration
    # and then LOCKED (the serializer rejects changes): every stored amount and
    # the balance live in this currency. New installs default to USD; the
    # migration backfills pre-existing rows to RSD.
    base_currency = models.CharField(max_length=3, default="USD")
    # Optional presentation currency. Blank == "show amounts in base_currency".
    # Purely a view preference — amounts are converted base->display at render
    # time (frontend) and never rewritten, so switching it is non-destructive.
    display_currency = models.CharField(max_length=3, blank=True, default="")
    open_ai_api_key = EncryptedCharField(max_length=500, blank=True, null=True)
    anthropic_api_key = EncryptedCharField(max_length=500, blank=True, null=True)
    ollama_base_url = models.CharField(max_length=255, blank=True)
    lmstudio_base_url = models.CharField(max_length=255, blank=True)
    llm_provider = models.CharField(
        max_length=16, choices=LLM_PROVIDER_CHOICES, default="openai"
    )
    llm_model = models.CharField(max_length=100, blank=True)
    t212_api_key = EncryptedCharField(max_length=500, blank=True, null=True)
    t212_api_secret = EncryptedCharField(max_length=500, blank=True, null=True)
    t212_environment = models.CharField(
        max_length=4, choices=T212_ENVIRONMENT_CHOICES, default="live"
    )

    # Telegram remote-control bot config. Stored PLAINTEXT (not EncryptedCharField)
    # on purpose: the poller runs headless at sidecar boot, before any vault
    # unlock, so it must read the token without the DEK. The token grants control
    # of the *bot* (add/read only), never the vault. See api/telegram_bot.py.
    telegram_enabled = models.BooleanField(default=False)
    telegram_bot_token = models.CharField(max_length=100, blank=True, default="")
    telegram_allowed_user_id = models.CharField(
        max_length=32, blank=True, default=""
    )

    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s settings"


@receiver(post_save, sender=User)
def create_user_settings(sender, instance, created, **kwargs):
    if created:
        Settings.objects.create(user=instance)


class Vault(models.Model):
    """Per-account key material for the master-password envelope encryption.

    Holds the account's Data Encryption Key (DEK) wrapped two ways: by a
    password-derived key (KEK, via scrypt over `kdf_salt`) and by a one-time
    recovery key. The DEK plaintext is never stored — it is unwrapped into
    process memory at login (see api/vault.py). There is deliberately **no**
    auto-create signal: a vault can only be built when a password is available,
    so it is created explicitly at registration / first login.
    """

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="vault"
    )
    kdf_salt = models.BinaryField()
    wrapped_dek = models.TextField()
    recovery_wrapped_dek = models.TextField()

    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s vault"


class Category(models.Model):

    TYPE_CHOICES = [
        ("expense", "Expense"),
        ("income", "Income"),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=7, choices=TYPE_CHOICES)

    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


# Starter categories seeded on registration so a new user can add a transaction
# immediately instead of hitting a category-less form on first launch. Users are
# free to rename or delete any of these.
DEFAULT_CATEGORIES = (
    ("Groceries", "expense"),
    ("Rent", "expense"),
    ("Utilities", "expense"),
    ("Transport", "expense"),
    ("Dining Out", "expense"),
    ("Entertainment", "expense"),
    ("Healthcare", "expense"),
    ("Shopping", "expense"),
    ("Salary", "income"),
    ("Other Income", "income"),
)


@receiver(post_save, sender=User)
def seed_default_categories(sender, instance, created, **kwargs):
    if created:
        Category.objects.bulk_create(
            [
                Category(user=instance, name=name, type=type)
                for name, type in DEFAULT_CATEGORIES
            ]
        )


class Transaction(models.Model):

    TYPE_CHOICES = [
        ("expense", "Expense"),
        ("income", "Income"),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    date = models.DateField()

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    name = models.CharField(max_length=255)
    category = models.ForeignKey(Category, on_delete=models.CASCADE)
    type = models.CharField(max_length=7, choices=TYPE_CHOICES)

    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.date} - {self.name}"


class Budget(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    category = models.ForeignKey(Category, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    month = models.DateField()  # always normalized to the 1st of the month

    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "category", "month"],
                name="unique_budget_per_category_month",
            )
        ]

    def __str__(self):
        return f"{self.category.name} - {self.month:%Y-%m}"


class PortfolioSnapshot(models.Model):
    """Daily cache of the user's Trading 212 portfolio state."""

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    date = models.DateField()
    total_value = models.DecimalField(max_digits=14, decimal_places=2)
    cash = models.DecimalField(max_digits=14, decimal_places=2)
    invested = models.DecimalField(max_digits=14, decimal_places=2)
    unrealized_pl = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, blank=True)
    positions = models.JSONField(default=list)
    fetched_at = models.DateTimeField()
    # total_value expressed in the app's base currency (RSD). Populated by the
    # FX conversion at fetch time; net-worth aggregation reads this, not the
    # native total_value, so mixed-currency holdings sum correctly.
    base_currency = models.CharField(max_length=3, blank=True)
    base_value = models.DecimalField(
        max_digits=16, decimal_places=2, null=True, blank=True
    )
    fx_rate = models.DecimalField(
        max_digits=18, decimal_places=8, null=True, blank=True
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "date"],
                name="unique_portfolio_snapshot_per_day",
            )
        ]

    def __str__(self):
        return f"{self.user.username} portfolio @ {self.date}"


class ExchangeRate(models.Model):
    """Daily cache of a base->quote FX rate, to avoid re-hitting the FX API.

    Not per-user: rates are global. One row per (base, quote, date)."""

    base = models.CharField(max_length=3)
    quote = models.CharField(max_length=3)
    date = models.DateField()
    rate = models.DecimalField(max_digits=18, decimal_places=8)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["base", "quote", "date"],
                name="unique_exchange_rate_per_day",
            )
        ]

    def __str__(self):
        return f"{self.base}->{self.quote} @ {self.date}: {self.rate}"


class NetWorthSnapshot(models.Model):
    """Daily upsert of total net worth, written by the process-on-load hook."""

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    date = models.DateField()
    account_balance = models.DecimalField(max_digits=12, decimal_places=2)
    savings_total = models.DecimalField(max_digits=12, decimal_places=2)
    portfolio_value = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "date"],
                name="unique_net_worth_snapshot_per_day",
            )
        ]

    @property
    def net_worth(self):
        return self.account_balance + self.savings_total + self.portfolio_value

    def __str__(self):
        return f"{self.user.username} net worth @ {self.date}"


class RecurringTransaction(models.Model):

    TYPE_CHOICES = [
        ("expense", "Expense"),
        ("income", "Income"),
    ]
    FREQUENCY_CHOICES = [
        ("daily", "Daily"),
        ("weekly", "Weekly"),
        ("monthly", "Monthly"),
        ("yearly", "Yearly"),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    # Currency `amount` is expressed in. Blank == base currency. When the rule
    # fires (services.process_recurring), the amount is converted from this
    # currency into the account's base before the Transaction is created, so
    # the balance stays purely in base.
    currency = models.CharField(max_length=3, blank=True, default="")
    category = models.ForeignKey(Category, on_delete=models.CASCADE)
    type = models.CharField(max_length=7, choices=TYPE_CHOICES)
    frequency = models.CharField(max_length=7, choices=FREQUENCY_CHOICES)
    next_due = models.DateField()
    active = models.BooleanField(default=True)

    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.frequency})"


class SavingsAccount(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    balance = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    apy_rate = models.DecimalField(max_digits=5, decimal_places=2)  # percent
    active = models.BooleanField(default=True)
    last_interest_date = models.DateField()

    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.apy_rate}%)"


class SavingsTransaction(models.Model):

    TYPE_CHOICES = [
        ("deposit", "Deposit"),
        ("withdraw", "Withdraw"),
        ("interest", "Interest"),
    ]
    account = models.ForeignKey(
        SavingsAccount, on_delete=models.CASCADE, related_name="transactions"
    )
    type = models.CharField(max_length=8, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField()

    date_created = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.account.name}: {self.type} {self.amount}"


def _balance_effect(transaction):
    """Signed impact of a transaction on the account balance.

    Balance is driven by the *category* type (income adds, expense subtracts),
    matching how transactions are created.
    """
    if transaction.category.type == "income":
        return transaction.amount
    if transaction.category.type == "expense":
        return -transaction.amount
    return Decimal("0")


@receiver(pre_save, sender=Transaction)
def stash_old_balance_effect(sender, instance, **kwargs):
    """Capture the pre-edit balance effect so post_save can apply the delta.

    On create there's no prior row, so the old effect is zero and post_save
    applies the full new effect (unchanged behavior). On edit we read the
    committed row to know exactly what to back out.
    """
    if instance.pk:
        old = Transaction.objects.filter(pk=instance.pk).first()
        instance._old_balance_effect = _balance_effect(old) if old else Decimal("0")
    else:
        instance._old_balance_effect = Decimal("0")


@receiver(post_save, sender=Transaction)
def update_balance_post_save(sender, instance, created, **kwargs):
    # Apply only the change (new effect minus what was there before), so edits
    # to amount/category/type re-balance correctly and creates apply in full.
    old_effect = getattr(instance, "_old_balance_effect", Decimal("0"))
    delta = _balance_effect(instance) - old_effect
    if delta:
        account = Account.objects.get(user=instance.user)
        account.balance += delta
        account.save()


@receiver(post_delete, sender=Transaction)
def update_balance_post_delete(sender, instance, **kwargs):
    account = Account.objects.get(user=instance.user)
    account.balance -= _balance_effect(instance)
    account.save()
