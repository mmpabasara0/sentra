import re
from datetime import datetime, timedelta, timezone

from app.utils.supabase_client import get_supabase

SUSPICIOUS_STORE_WORDS = {"official", "guaranteed", "cheap", "discount", "promo", "best"}
MARKETING_WORDS = {"amazing", "premium", "guaranteed", "must buy", "best ever", "unbeatable", "perfect"}


def _add(reasons, category, rule_code, reason, impact):
    reasons.append(
        {
            "category": category,
            "rule_code": rule_code,
            "reason": reason,
            "score_impact": impact,
        }
    )


def _classify_trust(score: int) -> str:
    """Seller application trust score: higher is better."""
    if score >= 80:
        return "Strong"
    if score >= 60:
        return "Needs Review"
    return "At Risk"


def _classify_risk(score: int) -> str:
    """Product / review risk score: higher is worse."""
    if score >= 60:
        return "High Risk"
    if score >= 30:
        return "Suspicious"
    return "Genuine"


def analyze_seller_application(application, profile, documents=None):
    reasons = []
    documents = documents or []
    doc_types = {doc.get("document_type") for doc in documents}

    required_docs = {"nic", "utility_bill"}
    missing_docs = sorted(required_docs - doc_types)
    if missing_docs:
        _add(reasons, "Document Risk", "MISSING_REQUIRED_DOCUMENTS", "Required seller verification documents are missing.", 18)

    missing_profile = [field for field in ["full_name", "phone", "address"] if not profile.get(field)]
    if len(missing_profile) >= 2:
        _add(reasons, "Profile Risk", "INCOMPLETE_CUSTOMER_PROFILE", "Customer profile is incomplete before seller upgrade.", 10)

    if profile.get("phone") and application.get("phone") and profile["phone"] != application["phone"]:
        _add(reasons, "Profile Risk", "CONTACT_MISMATCH", "Seller phone number differs from customer profile phone.", 6)

    store_name = (application.get("store_name") or "").lower()
    if any(word in store_name for word in SUSPICIOUS_STORE_WORDS):
        _add(reasons, "Store Risk", "SUSPICIOUS_STORE_NAME", "Store name uses promotional or trust-claim wording.", 8)

    if re.fullmatch(r"[a-z]+\\d{4,}", store_name.replace(" ", "")):
        _add(reasons, "Store Risk", "RANDOM_STORE_NAME", "Store name resembles a random generated account.", 8)

    db = get_supabase()
    account_number = application.get("account_number")
    bank_last4 = application.get("account_number_last4")
    if account_number:
        reused_bank = (
            db.table("seller_applications")
            .select("id")
            .eq("account_number", account_number)
            .neq("profile_id", profile["id"])
            .limit(2)
            .execute()
        )
        if reused_bank.data:
            _add(reasons, "Payment Risk", "REUSED_PAYMENT_DETAIL", "Payment account is used by another seller application.", 12)
    elif bank_last4:
        reused_bank = (
            db.table("seller_applications")
            .select("id")
            .eq("account_number_last4", bank_last4)
            .neq("profile_id", profile["id"])
            .limit(2)
            .execute()
        )
        if reused_bank.data:
            _add(reasons, "Payment Risk", "REUSED_PAYMENT_DETAIL", "Payment account ending is used by another seller application.", 12)

    recent = (
        db.table("seller_applications")
        .select("id")
        .eq("profile_id", profile["id"])
        .gte("submitted_at", (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat())
        .execute()
    )
    if len(recent.data or []) >= 2:
        _add(reasons, "Behavior Risk", "REPEATED_APPLICATIONS", "Multiple seller applications were submitted recently.", 8)

    penalty = min(sum(item["score_impact"] for item in reasons), 100)
    score = max(0, 100 - penalty)
    return {"risk_score": score, "risk_label": _classify_trust(score), "reasons": reasons}


def analyze_product_listing(product, seller):
    reasons = []
    text = f"{product.get('name', '')} {product.get('description', '')}".lower()

    if len((product.get("description") or "").split()) < 8:
        _add(reasons, "Listing Risk", "SHORT_DESCRIPTION", "Product description is too short for review.", 9)

    marketing_hits = [word for word in MARKETING_WORDS if word in text]
    if len(marketing_hits) >= 2:
        _add(reasons, "Listing Risk", "MARKETING_HEAVY_LISTING", "Listing uses repeated promotional wording.", 10)

    price = float(product.get("price") or 0)
    if price <= 0:
        _add(reasons, "Listing Risk", "INVALID_PRICE", "Product price is not valid.", 25)
    elif price < 250 or price > 500000:
        _add(reasons, "Listing Risk", "UNUSUAL_PRICE", "Product price is unusual for NovaMart catalog ranges.", 8)

    db = get_supabase()
    duplicate = (
        db.table("products")
        .select("id")
        .ilike("description", product.get("description") or "")
        .neq("seller_id", seller["id"])
        .limit(2)
        .execute()
    )
    if duplicate.data:
        _add(reasons, "Listing Risk", "DUPLICATE_LISTING_TEXT", "Similar product text exists from another seller.", 12)

    recent = (
        db.table("products")
        .select("id")
        .eq("seller_id", seller["id"])
        .gte("created_at", (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat())
        .execute()
    )
    if len(recent.data or []) >= 5:
        _add(reasons, "Behavior Risk", "SELLER_UPLOAD_BURST", "Seller submitted many products in a short time.", 12)

    score = min(sum(item["score_impact"] for item in reasons), 100)
    return {"risk_score": score, "risk_label": _classify_risk(score), "reasons": reasons}
