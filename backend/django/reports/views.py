"""
Reports API for the admin dashboard.

  GET /reports/summary/                today, week, month totals
  GET /reports/revenue/?days=30        revenue + visits per day
  GET /reports/services/?days=90       bookings and revenue per service
  GET /reports/barbers/?days=30        per-barber performance
  GET /reports/customers/top/?limit=10 best customers by spend
  GET /reports/retention/              new vs returning customers per month
  GET /reports/export/bookings.csv     CSV download of bookings in a range
"""
import csv
from datetime import date, timedelta

from django.db.models import Count, F, Q, Sum
from django.db.models.functions import TruncMonth
from django.http import HttpResponse, JsonResponse

from .auth import admin_required
from .models import Barber, Booking, Service, User


def _days(request, default):
    try:
        return max(1, min(365, int(request.GET.get("days", default))))
    except ValueError:
        return default


def _money(value):
    return float(value or 0)


@admin_required
def summary(request):
    today = date.today()
    week_start = today - timedelta(days=today.weekday() + 1 if today.weekday() != 6 else 0)
    month_start = today.replace(day=1)
    completed = Booking.objects.filter(status="completed")

    def block(start, end=None):
        qs = completed.filter(booking_date__gte=start)
        if end:
            qs = qs.filter(booking_date__lte=end)
        agg = qs.aggregate(revenue=Sum("price"), visits=Count("id"))
        return {"revenue": _money(agg["revenue"]), "visits": agg["visits"]}

    upcoming = Booking.objects.filter(booking_date__gte=today, status__in=["pending", "confirmed"]).count()
    pending = Booking.objects.filter(booking_date__gte=today, status="pending").count()
    no_shows_30 = Booking.objects.filter(status="no-show", booking_date__gte=today - timedelta(days=30)).count()
    cancels_30 = Booking.objects.filter(status="cancelled", booking_date__gte=today - timedelta(days=30)).count()

    return JsonResponse({
        "today": block(today, today),
        "week": block(week_start),
        "month": block(month_start),
        "upcoming": upcoming,
        "pending": pending,
        "customers": User.objects.filter(role="customer").count(),
        "new_customers_30d": User.objects.filter(role="customer", created_at__date__gte=today - timedelta(days=30)).count(),
        "no_shows_30d": no_shows_30,
        "cancellations_30d": cancels_30,
    })


@admin_required
def revenue(request):
    days = _days(request, 30)
    start = date.today() - timedelta(days=days - 1)
    rows = (Booking.objects.filter(status="completed", booking_date__gte=start)
            .values("booking_date").annotate(revenue=Sum("price"), visits=Count("id")).order_by("booking_date"))
    by_day = {r["booking_date"]: r for r in rows}
    series = []
    for i in range(days):
        d = start + timedelta(days=i)
        r = by_day.get(d)
        series.append({"date": d.isoformat(), "revenue": _money(r["revenue"]) if r else 0, "visits": r["visits"] if r else 0})
    return JsonResponse({"days": days, "series": series,
                         "total_revenue": sum(s["revenue"] for s in series),
                         "total_visits": sum(s["visits"] for s in series)})


@admin_required
def services(request):
    days = _days(request, 90)
    start = date.today() - timedelta(days=days)
    rows = (Service.objects.annotate(
                bookings=Count("booking", filter=Q(booking__status="completed", booking__booking_date__gte=start)),
                revenue=Sum("booking__price", filter=Q(booking__status="completed", booking__booking_date__gte=start)))
            .order_by("-bookings", "name"))
    return JsonResponse({"days": days, "services": [
        {"id": s.id, "name": s.name, "price": _money(s.price), "active": s.active,
         "bookings": s.bookings, "revenue": _money(s.revenue)} for s in rows]})


@admin_required
def barbers(request):
    days = _days(request, 30)
    start = date.today() - timedelta(days=days)
    window = Q(booking__booking_date__gte=start)
    rows = (Barber.objects.annotate(
                completed=Count("booking", filter=window & Q(booking__status="completed")),
                no_shows=Count("booking", filter=window & Q(booking__status="no-show")),
                cancelled=Count("booking", filter=window & Q(booking__status="cancelled")),
                revenue=Sum("booking__price", filter=window & Q(booking__status="completed")))
            .order_by("-revenue"))
    return JsonResponse({"days": days, "barbers": [
        {"id": b.id, "name": b.name, "active": b.active, "completed": b.completed,
         "no_shows": b.no_shows, "cancelled": b.cancelled, "revenue": _money(b.revenue)} for b in rows]})


@admin_required
def top_customers(request):
    try:
        limit = max(1, min(100, int(request.GET.get("limit", 10))))
    except ValueError:
        limit = 10
    rows = (User.objects.filter(role="customer")
            .annotate(visits=Count("booking", filter=Q(booking__status="completed")),
                      spent=Sum("booking__price", filter=Q(booking__status="completed")))
            .filter(visits__gt=0).order_by("-spent")[:limit])
    return JsonResponse({"customers": [
        {"id": u.id, "name": f"{u.first_name} {u.last_name}", "email": u.email,
         "visits": u.visits, "spent": _money(u.spent), "points": _money(u.spent)} for u in rows]})


@admin_required
def retention(request):
    """Per month: how many completed visits came from first-time vs returning customers."""
    first_visit = {}
    for b in Booking.objects.filter(status="completed").order_by("booking_date", "booking_time").values("user_id", "booking_date"):
        first_visit.setdefault(b["user_id"], b["booking_date"])
    months = {}
    for b in Booking.objects.filter(status="completed").values("user_id", "booking_date"):
        key = b["booking_date"].strftime("%Y-%m")
        bucket = months.setdefault(key, {"month": key, "new": 0, "returning": 0})
        bucket["new" if first_visit[b["user_id"]] == b["booking_date"] else "returning"] += 1
    return JsonResponse({"months": [months[k] for k in sorted(months)][-12:]})


@admin_required
def export_bookings(request):
    start = request.GET.get("from") or (date.today() - timedelta(days=30)).isoformat()
    end = request.GET.get("to") or date.today().isoformat()
    qs = (Booking.objects.filter(booking_date__range=[start, end])
          .select_related("user", "barber", "service").order_by("booking_date", "booking_time"))
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="barberfie-bookings-{start}-to-{end}.csv"'
    writer = csv.writer(response)
    writer.writerow(["Date", "Time", "Customer", "Email", "Service", "Barber", "Price (GHS)", "Status"])
    for b in qs:
        writer.writerow([b.booking_date, b.booking_time.strftime("%H:%M"), str(b.user), b.user.email,
                         b.service.name, b.barber.name if b.barber else "", b.price, b.status])
    return response
