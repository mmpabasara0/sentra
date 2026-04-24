from datetime import datetime, timezone

from app.utils.supabase_client import get_supabase


def _notification_row(profile_id, category, type_name, title, message, href="", metadata=None):
    return {
        "profile_id": profile_id,
        "category": category,
        "type": type_name,
        "title": title,
        "message": message,
        "href": href or "",
        "metadata_json": metadata or {},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def notify_profile(profile_id, category, type_name, title, message, href="", metadata=None):
    if not profile_id:
        return
    try:
        get_supabase().table("notifications").insert(
            _notification_row(profile_id, category, type_name, title, message, href, metadata)
        ).execute()
    except Exception:
        # Notifications should never block checkout, moderation, or onboarding flows.
        return


def notify_many(profile_ids, category, type_name, title, message, href="", metadata=None):
    unique_ids = sorted({profile_id for profile_id in profile_ids if profile_id})
    if not unique_ids:
        return
    try:
        rows = [
            _notification_row(profile_id, category, type_name, title, message, href, metadata)
            for profile_id in unique_ids
        ]
        get_supabase().table("notifications").insert(rows).execute()
    except Exception:
        return


def notify_admins(type_name, title, message, href="", metadata=None):
    try:
        admins = (
            get_supabase()
            .table("profiles")
            .select("id")
            .eq("role", "admin")
            .eq("status", "active")
            .execute()
            .data
            or []
        )
    except Exception:
        return
    notify_many([admin["id"] for admin in admins], "admin", type_name, title, message, href, metadata)


def notify_seller_id(seller_id, type_name, title, message, href="", metadata=None):
    if not seller_id:
        return
    try:
        seller = (
            get_supabase()
            .table("sellers")
            .select("profile_id")
            .eq("id", seller_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except Exception:
        return
    if seller:
        notify_profile(seller[0]["profile_id"], "seller", type_name, title, message, href, metadata)
