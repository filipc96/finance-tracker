from django.db import models
from decimal import Decimal

from django.contrib.auth.models import User
from django.dispatch import receiver
from django.db.models.signals import post_save, post_delete


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

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    dark_mode = models.BooleanField(default=False)
    open_ai_api_key = models.CharField(max_length=255, blank=True, null=True)
    t212_api_key = models.CharField(max_length=255, blank=True, null=True)
    t212_api_secret = models.CharField(max_length=255, blank=True, null=True)
    t212_environment = models.CharField(
        max_length=4, choices=T212_ENVIRONMENT_CHOICES, default="live"
    )

    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s settings"


@receiver(post_save, sender=User)
def create_user_settings(sender, instance, created, **kwargs):
    if created:
        Settings.objects.create(user=instance)


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

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "date"],
                name="unique_portfolio_snapshot_per_day",
            )
        ]

    def __str__(self):
        return f"{self.user.username} portfolio @ {self.date}"


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


@receiver(post_save, sender=Transaction)
def update_balance_post_save(sender, instance, created, **kwargs):
    if created:
        account = Account.objects.get(user=instance.user)
        if instance.category.type == "income":
            account.balance += instance.amount
        elif instance.category.type == "expense":
            account.balance -= instance.amount
        account.save()


@receiver(post_delete, sender=Transaction)
def update_balance_post_delete(sender, instance, **kwargs):
    account = Account.objects.get(user=instance.user)

    if account:
        account = Account.objects.get(user=instance.user)
        if instance.category.type == "income":
            account.balance -= instance.amount
        elif instance.category.type == "expense":
            account.balance += instance.amount
        account.save()
