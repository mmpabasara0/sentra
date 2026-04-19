import hashlib

from flask import Blueprint, request

from app.config.settings import Settings
from app.sentra_engine.scoring import analyze_review
from app.services.activity_service import log_activity
from app.services.anomaly_service import evaluate_review_anomalies
from app.services.notification_service import notify_admins, notify_profile, notify_seller_id
from app.services.trust_service import calculate_trust_score
from app.utils.auth import current_profile, require_auth
from app.utils.products import resolve_product
from app.utils.responses import error, ok
from app.utils.supabase_client import get_supabase


def _client_ip():
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return (request.headers.get("X-Real-IP") or request.remote_addr or "").strip()


def _hash_ip(ip):
    if not ip:
        return ""
    salt = (Settings().supabase_url or "sentra") + ":ip"
    return hashlib.sha256((salt + ip).encode("utf-8")).hexdigest()[:32]


def _device_fingerprint(body):
    header = (request.headers.get("X-Device-Fingerprint") or "").strip()
    if header:
        return header[:64]
    fp = (body.get("device_fingerprint") if isinstance(body, dict) else "") or ""
    return str(fp).strip()[:64]

reviews_bp = Blueprint("reviews", __name__)


@reviews_bp.get("/products/<product_id>/reviews")
def list_reviews(product_id):
    product = resolve_product(product_id)
    if not product:
        return error("Product was not found.", 404, "not_found")
    res = (
        get_supabase()
        .table("reviews")
        .select("*, profiles(full_name, username), review_flags(*)")
        .eq("product_id", product["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return ok({"reviews": res.data or []})


@reviews_bp.post("/products/<product_id>/reviews")
@require_auth
def create_review(product_id):
    body = request.get_json(silent=True) or {}
    if not body.get("body") or not body.get("rating"):
        return error("Rating and review text are required.", 422, "validation_error")
    rating = int(body.get("rating"))
    if rating < 1 or rating > 5:
        return error("Rating must be between 1 and 5.", 422, "validation_error")

    db = get_supabase()
    profile = current_profile()
    product = resolve_product(product_id)
    if not product:
        return error("Product was not found.", 404, "not_found")
    purchase = (
        db.table("orders")
        .select("id, order_items!inner(product_id)")
        .eq("user_id", profile["id"])
        .eq("order_items.product_id", product["id"])
        .execute()
    )
    ip_hash = _hash_ip(_client_ip())
    user_agent = (request.headers.get("User-Agent") or "")[:255]
    device_fingerprint = _device_fingerprint(body)

    draft = {
        "product_id": product["id"],
        "user_id": profile["id"],
        "rating": rating,
        "title": body.get("title", ""),
        "body": body["body"].strip(),
        "is_verified_purchase": bool(purchase.data),
        "status": "pending",
        "risk_score": 0,
        "risk_label": "Pending",
        "ip_hash": ip_hash,
        "user_agent": user_agent,
        "device_fingerprint": device_fingerprint,
    }
    analysis = analyze_review(draft, product, profile)
    draft.update(
        {
            "risk_score": analysis["risk_score"],
            "risk_label": analysis["risk_label"],
            "status": analysis["status"],
        }
    )
    created = db.table("reviews").insert(draft).execute()
    review = created.data[0]
    flags = [{**flag, "review_id": review["id"]} for flag in analysis["flags"]]
    if flags:
        db.table("review_flags").insert(flags).execute()

    try:
        evaluate_review_anomalies(review, profile, db)
    except Exception:
        pass

    log_activity(profile["id"], "review_submitted", "review", review["id"], analysis)
    calculate_trust_score(profile["id"])
    notify_profile(
        profile["id"],
        "customer",
        "review_submitted",
        "Review submitted",
        f"Your review for {product['name']} was received.",
        "/dashboard",
        {"review_id": review["id"], "status": review["status"]},
    )
    if product.get("seller_id"):
        notify_seller_id(
            product["seller_id"],
            "review_submitted",
            "New product review",
            f"{product['name']} received a new customer review.",
            "/seller/reviews",
            {"review_id": review["id"], "product_id": product["id"]},
        )
    if review.get("status") in ["flagged", "quarantined"]:
        notify_admins(
            "review_flagged",
            "Review needs moderation",
            f"Sentra flagged a review for {product['name']} with score {review['risk_score']}/100.",
            f"/admin/reviews/{review['id']}",
            {"review_id": review["id"], "product_id": product["id"], "risk_score": review["risk_score"]},
        )
    return ok({"review": review, "analysis": analysis}, 201)
