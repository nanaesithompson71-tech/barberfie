"""
Verifies the HS256 JWT issued by the Node API so admins can call the
reports endpoints with the same token they already hold. Implemented with
the standard library only, so no extra dependency is needed.
"""
import base64
import hashlib
import hmac
import json
import time
from functools import wraps

from django.conf import settings
from django.http import JsonResponse

from .models import User


def _b64decode(segment: str) -> bytes:
    segment += "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment)


def verify_jwt(token: str) -> dict | None:
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
        header = json.loads(_b64decode(header_b64))
        if header.get("alg") != "HS256":
            return None
        expected = hmac.new(settings.JWT_SECRET.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64decode(sig_b64)):
            return None
        payload = json.loads(_b64decode(payload_b64))
        if payload.get("exp") and payload["exp"] < time.time():
            return None
        return payload
    except Exception:
        return None


def admin_required(view):
    """Allow either a valid admin JWT or a logged-in Django superuser."""
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        if request.user.is_authenticated and request.user.is_staff:
            return view(request, *args, **kwargs)
        auth = request.headers.get("Authorization", "")
        payload = verify_jwt(auth[7:]) if auth.startswith("Bearer ") else None
        if not payload:
            return JsonResponse({"error": "Sign in required."}, status=401)
        user = User.objects.filter(pk=payload.get("sub"), role="admin").first()
        if not user:
            return JsonResponse({"error": "Admin access only."}, status=403)
        request.api_user = user
        return view(request, *args, **kwargs)
    return wrapper
