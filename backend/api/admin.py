from django.contrib import admin
from .models import Transaction, Category, Account, Settings
from django.contrib.auth.models import User

from django.contrib.auth.admin import UserAdmin as AuthUserAdmin


class UserProfileInline(admin.StackedInline):
    model = Account
    can_delete = False


class AccountsUserAdmin(AuthUserAdmin):
    def add_view(self, *args, **kwargs):
        self.inlines = []
        return super(AccountsUserAdmin, self).add_view(*args, **kwargs)

    def change_view(self, *args, **kwargs):
        self.inlines = [UserProfileInline]
        return super(AccountsUserAdmin, self).change_view(*args, **kwargs)


class CategoryAdmin(admin.ModelAdmin):
    readonly_fields = ["id"]

admin.site.unregister(User)
admin.site.register(User, AccountsUserAdmin)

# Register your models here.
admin.site.register(Transaction)
admin.site.register(Category, CategoryAdmin)
admin.site.register(Settings)

