"""Django admin: a direct, audited view of the shared database."""
from django.contrib import admin

from .models import Barber, Booking, ContactMessage, OpeningHours, ReminderLog, Service, ShopSetting, User


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("booking_date", "booking_time", "user", "service", "barber", "price", "status", "reminder_sent")
    list_filter = ("status", "barber", "service", "booking_date")
    search_fields = ("user__first_name", "user__last_name", "user__email")
    date_hierarchy = "booking_date"
    list_per_page = 50


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "email", "phone", "role", "favourite_barber", "created_at")
    list_filter = ("role",)
    search_fields = ("first_name", "last_name", "email", "phone")
    exclude = ("password_hash",)


@admin.register(Barber)
class BarberAdmin(admin.ModelAdmin):
    list_display = ("name", "bio", "working_days", "active")
    list_filter = ("active",)


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "price", "duration_min", "active")
    list_filter = ("active",)


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("created_at", "name", "email", "is_read")
    list_filter = ("is_read",)
    search_fields = ("name", "email", "message")
    actions = ["mark_read"]

    @admin.action(description="Mark selected messages as read")
    def mark_read(self, request, queryset):
        queryset.update(is_read=True)


admin.site.register(OpeningHours)
admin.site.register(ShopSetting)
admin.site.register(ReminderLog)
