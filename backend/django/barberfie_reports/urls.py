from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "BARBERFIE database admin"
admin.site.site_title = "BARBERFIE"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("reports/", include("reports.urls")),
]
