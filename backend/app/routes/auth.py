import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flask import Blueprint, g, request

from app.config.settings import Settings
from app.utils.auth import require_auth, current_profile
from app.utils.responses import error, ok
from app.utils.supabase_client import get_supabase

auth_bp = Blueprint("auth", __name__)


def _profile_with_auth_email(profile):
    if not profile:
        return profile

    claims = g.current_user.get("claims") or {}
    return {**profile, "email": claims.get("email", "")}


def _clean_username(value):
    username = re.sub(r"[^a-zA-Z0-9_]+", "_", (value or "").strip()).strip("_")
    return username[:32] or "customer"


def _default_profile_payload(body):
    claims = g.current_user.get("claims") or {}
    metadata = claims.get("user_metadata") or {}
    email = claims.get("email") or ""
    email_name = email.split("@")[0] if "@" in email else ""
    return {
        "auth_user_id": g.current_user["auth_user_id"],
        "full_name": (body.get("full_name") or metadata.get("full_name") or metadata.get("username") or email_name or "Customer").strip(),
        "username": _clean_username(body.get("username") or metadata.get("username") or email_name or f"user_{g.current_user['auth_user_id'][:8]}"),
        "role": "customer",
        "phone": (body.get("phone") or "").strip(),
        "address": (body.get("address") or "").strip(),
        "status": "active",
    }


def _unique_username(db, username):
    candidate = _clean_username(username)
    suffix = 2
    while db.table("profiles").select("id").eq("username", candidate).limit(1).execute().data:
        base = candidate[: max(1, 29 - len(str(suffix)))]
        candidate = f"{base}_{suffix}"
        suffix += 1
    return candidate


def _public_auth_user(user):
    email_confirmed_at = user.get("email_confirmed_at") or user.get("confirmed_at")
    return {
        "exists": True,
        "verified": bool(email_confirmed_at),
        "status": "verified" if email_confirmed_at else "unverified",
    }


def _find_auth_user_by_email(email):
    settings = Settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase URL and service role key are required.")

    base_url = settings.supabase_url.rstrip("/")
    target_email = email.strip().lower()

    for page in range(1, 6):
        query = urlencode({"page": page, "per_page": 100})
        admin_url = f"{base_url}/auth/v1/admin/users?{query}"
        req = Request(
            admin_url,
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "Content-Type": "application/json",
            },
            method="GET",
        )

        with urlopen(req, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))

        users = payload.get("users", []) if isinstance(payload, dict) else payload if isinstance(payload, list) else []
        for user in users:
            if (user.get("email") or "").strip().lower() == target_email:
                return user

        if len(users) < 100:
            break

    return None


@auth_bp.post("/email-status")
def email_status():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()

    if not email or "@" not in email:
        return error("Enter a valid email address.", 400, "invalid_email")

    try:
        user = _find_auth_user_by_email(email)
    except HTTPError as exc:
        return error(f"Supabase Auth check failed with status {exc.code}.", 502, "auth_lookup_failed")
    except (URLError, TimeoutError, RuntimeError):
        return error("Could not check the Supabase Auth status right now.", 502, "auth_lookup_failed")

    if not user:
        return ok({
            "exists": False,
            "verified": False,
            "status": "not_found",
            "message": "No NovaMart account exists for this email yet.",
        })

    status = _public_auth_user(user)
    status["message"] = (
        "This email is verified. Sign in to continue."
        if status["verified"]
        else "This account exists but the email is not verified yet."
    )
    return ok(status)


@auth_bp.post("/sync-profile")
@require_auth
def sync_profile():
    body = request.get_json(silent=True) or {}
    profile = current_profile()
    if profile:
        return ok({"profile": _profile_with_auth_email(profile)})

    db = get_supabase()
    payload = _default_profile_payload(body)
    payload["username"] = _unique_username(db, payload["username"])
    created = db.table("profiles").insert(payload).execute()
    return ok({"profile": _profile_with_auth_email(created.data[0])}, 201)


@auth_bp.get("/me")
@require_auth
def me():
    return ok({"profile": _profile_with_auth_email(current_profile())})


@auth_bp.patch("/me")
@require_auth
def update_me():
    body = request.get_json(silent=True) or {}
    allowed_fields = ["full_name", "username", "phone", "address"]
    payload = {}

    for field in allowed_fields:
        if field in body:
            value = body.get(field)
            payload[field] = value.strip() if isinstance(value, str) else value

    if not payload:
        return error("No valid profile fields were provided.", 400, "bad_request")

    profile = current_profile()

    # If profile doesn't exist yet, create it using provided fields.
    if not profile:
        db = get_supabase()
        created_payload = _default_profile_payload(payload)
        created_payload["username"] = _unique_username(db, created_payload["username"])
        created = db.table("profiles").insert(created_payload).execute()
        return ok({"profile": _profile_with_auth_email(created.data[0])}, 201)

    updated = (
        get_supabase()
        .table("profiles")
        .update(payload)
        .eq("auth_user_id", g.current_user["auth_user_id"])
        .execute()
    )

    next_profile = updated.data[0] if updated.data else current_profile()
    next_profile = _profile_with_auth_email(next_profile)
    return ok({"profile": next_profile})
