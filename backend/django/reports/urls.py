from django.urls import path

from . import views

urlpatterns = [
    path("summary/", views.summary, name="reports-summary"),
    path("revenue/", views.revenue, name="reports-revenue"),
    path("services/", views.services, name="reports-services"),
    path("barbers/", views.barbers, name="reports-barbers"),
    path("customers/top/", views.top_customers, name="reports-top-customers"),
    path("retention/", views.retention, name="reports-retention"),
    path("export/bookings.csv", views.export_bookings, name="reports-export-bookings"),
]
