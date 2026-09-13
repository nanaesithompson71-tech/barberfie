"""
Read-only model mappings onto the shared MySQL tables created by
../database/schema.sql. managed=False means `migrate` never touches them.
"""
from django.db import models


class Barber(models.Model):
    name = models.CharField(max_length=120)
    bio = models.CharField(max_length=255, null=True, blank=True)
    working_days = models.CharField(max_length=20, default="1,2,3,4,5,6")
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "barbers"

    def __str__(self):
        return self.name


class Service(models.Model):
    name = models.CharField(max_length=120)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    duration_min = models.PositiveSmallIntegerField(default=30)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "services"

    def __str__(self):
        return f"{self.name} (GH₵ {self.price})"


class User(models.Model):
    ROLE_CHOICES = [("customer", "Customer"), ("admin", "Admin")]

    first_name = models.CharField(max_length=60)
    last_name = models.CharField(max_length=60)
    email = models.EmailField(max_length=190, unique=True)
    phone = models.CharField(max_length=30, null=True, blank=True)
    password_hash = models.CharField(max_length=255, editable=False)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="customer")
    notes = models.TextField(null=True, blank=True)
    favourite_barber = models.ForeignKey(Barber, null=True, blank=True, on_delete=models.SET_NULL, db_column="favourite_barber_id")
    pref_reminders = models.BooleanField(default=True)
    pref_promos = models.BooleanField(default=False)
    pref_whatsapp = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "users"

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class Booking(models.Model):
    STATUS_CHOICES = [(s, s.title()) for s in ("pending", "confirmed", "completed", "cancelled", "no-show")]

    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="user_id")
    barber = models.ForeignKey(Barber, null=True, blank=True, on_delete=models.SET_NULL, db_column="barber_id")
    service = models.ForeignKey(Service, on_delete=models.PROTECT, db_column="service_id")
    booking_date = models.DateField()
    booking_time = models.TimeField()
    price = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="confirmed")
    reminder_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "bookings"
        ordering = ["-booking_date", "-booking_time"]

    def __str__(self):
        return f"{self.user} - {self.service} on {self.booking_date}"


class OpeningHours(models.Model):
    day_of_week = models.PositiveSmallIntegerField(primary_key=True)
    opens = models.TimeField()
    closes = models.TimeField()
    is_open = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = "opening_hours"
        verbose_name_plural = "opening hours"


class ShopSetting(models.Model):
    setting_key = models.CharField(max_length=60, primary_key=True)
    setting_value = models.CharField(max_length=255)

    class Meta:
        managed = False
        db_table = "shop_settings"


class ContactMessage(models.Model):
    name = models.CharField(max_length=120)
    email = models.EmailField(max_length=190)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "contact_messages"
        ordering = ["-created_at"]


class ReminderLog(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, db_column="booking_id")
    channel = models.CharField(max_length=10)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "reminder_log"
