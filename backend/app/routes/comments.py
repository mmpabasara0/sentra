from flask import Blueprint, request

from app.utils.auth import current_profile, require_auth
from app.utils.products import resolve_product
from app.utils.responses import error, ok
from app.utils.supabase_client import get_supabase

comments_bp = Blueprint("comments", __name__)


def comment_risk(text):
    score = 0
    reasons = []
    lowered = text.lower().strip()
    if len(lowered.split()) < 3:
        score += 20
        reasons.append("Comment is very short.")
    if "http://" in lowered or "https://" in lowered or "www." in lowered:
        score += 35
        reasons.append("Comment contains a link.")
    if any(word in lowered for word in ["buy now", "discount", "promo", "whatsapp"]):
        score += 25
        reasons.append("Comment looks promotional.")
    if any(ch * 4 in lowered for ch in ["!", "?", "."]):
        score += 10
        reasons.append("Comment has repeated symbols.")
    return min(score, 100), reasons


@comments_bp.post("/reviews/<review_id>/comments")
@require_auth
def create_comment(review_id):
    body = request.get_json(silent=True) or {}
    text = (body.get("body") or "").strip()
    if not text:
        return error("Comment text is required.", 422, "validation_error")
    score, reasons = comment_risk(text)
    status = "flagged" if score >= 30 else "published"
    product = resolve_product(body.get("product_id")) if body.get("product_id") else None
    payload = {
        "review_id": review_id,
        "product_id": product["id"] if product else None,
        "user_id": current_profile()["id"],
        "body": text,
        "risk_score": score,
        "status": status,
    }
    created = get_supabase().table("comments").insert(payload).execute()
    return ok({"comment": created.data[0], "reasons": reasons}, 201)


@comments_bp.get("/reviews/<review_id>/comments")
def list_comments(review_id):
    res = (
        get_supabase()
        .table("comments")
        .select("*, profiles(full_name, username)")
        .eq("review_id", review_id)
        .order("created_at", desc=True)
        .execute()
    )
    return ok({"comments": res.data or []})
