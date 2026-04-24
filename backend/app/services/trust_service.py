from datetime import datetime, timezone

from app.utils.supabase_client import get_supabase


def _days_old(created_at):
    if not created_at:
        return 0
    value = created_at.replace("Z", "+00:00")
    return max((datetime.now(timezone.utc) - datetime.fromisoformat(value)).days, 0)


def trust_label(score):
    if score >= 71:
        return "Trusted Reviewer"
    if score >= 31:
        return "Moderate Risk Reviewer"
    return "High Risk Reviewer"


def calculate_trust_score(user_id):
    db = get_supabase()
    profile_res = db.table("profiles").select("*").eq("id", user_id).single().execute()
    profile = profile_res.data or {}
    reviews_res = db.table("reviews").select("*").eq("user_id", user_id).execute()
    reviews = reviews_res.data or []
    orders_res = db.table("orders").select("id").eq("user_id", user_id).execute()
    orders = orders_res.data or []

    approved = len([r for r in reviews if r.get("status") in ["published", "approved"]])
    flagged = len([r for r in reviews if r.get("status") == "flagged"])
    rejected = len([r for r in reviews if r.get("status") == "rejected"])
    quarantined = len([r for r in reviews if r.get("status") == "quarantined"])
    categories = set()
    if reviews:
        product_ids = [r["product_id"] for r in reviews if r.get("product_id")]
        if product_ids:
            product_res = db.table("products").select("id, category").in_("id", product_ids).execute()
            categories = {p.get("category") for p in product_res.data or [] if p.get("category")}

    score = 60
    age = _days_old(profile.get("created_at"))
    if age >= 30:
        score += 12
    elif age < 3:
        score -= 12

    completeness_fields = ["full_name", "username", "phone", "address"]
    completed = len([field for field in completeness_fields if profile.get(field)])
    score += completed * 3
    score += min(len(orders) * 5, 15)
    score += min(approved * 2, 10)
    score += min(len(categories) * 3, 9)
    score -= flagged * 8
    score -= rejected * 14
    score -= quarantined * 18

    score = max(0, min(100, score))
    payload = {
        "user_id": user_id,
        "trust_score": score,
        "trust_label": trust_label(score),
        "approved_reviews": approved,
        "flagged_reviews": flagged,
        "rejected_reviews": rejected,
        "quarantined_reviews": quarantined,
    }

    existing = db.table("user_trust_scores").select("id").eq("user_id", user_id).limit(1).execute()
    if existing.data:
        db.table("user_trust_scores").update(payload).eq("user_id", user_id).execute()
    else:
        db.table("user_trust_scores").insert(payload).execute()
    return payload
