from functools import wraps
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import json

from flask import g, request

from app.config.settings import Settings
from app.utils.responses import error
from app.utils.supabase_client import get_supabase


def _auth_backend_configured() -> bool:
    settings = Settings()
    return bool(settings.supabase_url and settings.supabase_service_role_key)


def _extract_token():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header.removeprefix("Bearer ").strip()


def verify_token():
    token = _extract_token()
    if not token:
        return None

    settings = Settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None

    user_request = Request(
        f"{settings.supabase_url}/auth/v1/user",
        headers={
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="GET",
    )
    try:
        with urlopen(user_request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return None

    auth_user_id = payload.get("id")
    if not auth_user_id:
        return None

    response = (
        get_supabase()
        .table("profiles")
        .select("*")
        .eq("auth_user_id", auth_user_id)
        .limit(1)
        .execute()
    )
    profile = response.data[0] if response.data else None
    return {"auth_user_id": auth_user_id, "profile": profile, "claims": payload}


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not _auth_backend_configured():
            return error(
                "Backend auth is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env.",
                500,
                "auth_config_missing",
            )
        current_user = verify_token()
        if not current_user:
            return error("Sign in to continue.", 401, "unauthorized")
        profile = current_user.get("profile")
        g.current_user = current_user
        if not profile and request.endpoint not in {"auth.me", "auth.sync_profile", "auth.update_me"}:
            return error("Your account profile is missing. Please sign out and sign in again.", 403, "profile_missing")
        profile = profile or {}
        if profile.get("status") == "restricted":
            return error("This account has been restricted by an administrator.", 403, "account_restricted")
        return fn(*args, **kwargs)

    return wrapper


def require_admin(fn):
    @wraps(fn)
    @require_auth
    def wrapper(*args, **kwargs):
        profile = g.current_user.get("profile") or {}
        if profile.get("role") != "admin":
            return error("Admin access is required.", 403, "forbidden")
        return fn(*args, **kwargs)

    return wrapper


def current_seller():
    profile = g.current_user.get("profile") or {}
    if not profile:
        return None
    res = (
        get_supabase()
        .table("sellers")
        .select("*")
        .eq("profile_id", profile["id"])
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def require_seller(fn):
    @wraps(fn)
    @require_auth
    def wrapper(*args, **kwargs):
        profile = g.current_user.get("profile") or {}
        seller = current_seller()
        if profile.get("role") not in ["seller", "admin"] or not seller:
            return error("Approved seller access is required.", 403, "seller_required")
        g.current_seller = seller
        return fn(*args, **kwargs)

    return wrapper


def current_profile():
    return (getattr(g, "current_user", {}) or {}).get("profile")
