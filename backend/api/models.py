from django.db import models

from django.contrib.auth.models import User
from django.dispatch import receiver
from django.db.models.signals import post_save, post_delete


class Account(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    balance = models.DecimalField(max_digits=10, decimal_places=2)

    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.user.username


@receiver(post_save, sender=User)
def create_user_account(sender, instance, created, **kwargs):
    if created:
        Account.objects.create(user=instance)


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

    @property
    def transactions_sum(self):
        total_amount = sum(self.transaction_set.all().values_list("amount", flat=True))
        return total_amount

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
def update_balance_post_delete(sender, instance, created, **kwargs):
    if created:
        account = Account.objects.get(user=instance.user)
        if instance.category.type == "income":
            account.balance -= instance.amount
        elif instance.category.type == "expense":
            account.balance += instance.amount
        account.save()
