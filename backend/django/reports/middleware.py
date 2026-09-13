"""Small CORS layer so the admin dashboard in the browser can call /reports/."""
from django.conf import settings


class CorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.allowed = [o.strip() for o in settings.CORS_ORIGIN.split(",")]

    def __call__(self, request):
        origin = request.headers.get("Origin", "")
        if request.method == "OPTIONS" and request.path.startswith("/reports/"):
            from django.http import HttpResponse
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)
        if request.path.startswith("/reports/") and ("*" in self.allowed or origin in self.allowed):
            response["Access-Control-Allow-Origin"] = origin or "*"
            response["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
            response["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        return response
