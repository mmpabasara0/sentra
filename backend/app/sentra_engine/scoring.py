import re
from collections import Counter
from datetime import datetime, timedelta, timezone

from app.utils.supabase_client import get_supabase

GENERIC_REVIEWS = {
    "good product",
    "nice item",
    "best product ever",
    "very good",
    "excellent product",
    "highly recommended",
}
MARKETING_WORDS = {
    "amazing",
    "perfect",
    "unbeatable",
    "premium",
    "guaranteed",
    "must buy",
    "life changing",
    "best ever",
}
POSITIVE_WORDS = {"good", "great", "excellent", "perfect", "amazing", "love", "best"}
NEGATIVE_WORDS = {"bad", "poor", "broken", "waste", "terrible", "hate", "awful"}
PRAISE_LEXICON = {
    "good", "great", "super", "superr", "nice", "wow", "waw", "cool",
    "awesome", "amazing", "best", "love", "loved", "perfect", "excellent",
    "fantastic", "fab", "fire", "lit", "ok", "okay", "fine", "yes",
    "product", "item", "thing", "stuff",
}


def clamp(value, maximum):
    return min(value, maximum)


def _now_iso_minus(minutes):
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()


def _normalize(text):
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _tokens(text):
    return re.findall(r"[a-zA-Z']+", _normalize(text))


def _add(flags, category, rule_code, reason, impact):
    flags.append(
        {
            "category": category,
            "rule_code": rule_code,
            "reason": reason,
            "score_impact": impact,
        }
    )


def _account_age_hours(profile):
    created_at = (profile or {}).get("created_at")
    if not created_at:
        return None
    try:
        created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except ValueError:
        return None
    delta = datetime.now(timezone.utc) - created
    return delta.total_seconds() / 3600.0


def _int_override(review, key):
    value = review.get(key)
    if value in [None, ""]:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def text_risk(review, db, product=None):
    flags = []
    body = _normalize(review.get("body", ""))
    title = _normalize(review.get("title", ""))
    words = re.findall(r"[a-zA-Z']+", body)
    word_counts = Counter(words)
    rating = int(review.get("rating", 0))

    if len(words) < 6:
        _add(flags, "Text Risk", "TEXT_TOO_SHORT", "Review is too short to be useful.", 10)
    if body in GENERIC_REVIEWS:
        _add(flags, "Text Risk", "GENERIC_REVIEW", "Review uses generic wording.", 9)
    if any(count >= 3 for count in word_counts.values()):
        _add(flags, "Text Risk", "REPEATED_WORDS", "Review repeats words unnaturally.", 8)
    if re.search(r"([!?*.])\1{2,}", body):
        _add(flags, "Text Risk", "EXCESSIVE_SYMBOLS", "Review has excessive punctuation or symbols.", 5)
    if re.search(r"https?://|www\.", body):
        _add(flags, "Text Risk", "LINK_SPAM", "Review contains an external link.", 10)
    marketing_hits = [word for word in MARKETING_WORDS if word in body]
    if len(marketing_hits) >= 2:
        _add(flags, "Text Risk", "MARKETING_LANGUAGE", "Review uses promotional language.", 8)

    unique_meaningful = {w for w in words if len(w) > 2}
    if (
        rating >= 4
        and len(body) <= 30
        and len(unique_meaningful) <= 5
        and words
        and sum(1 for w in words if w in PRAISE_LEXICON) / max(len(words), 1) >= 0.5
    ):
        _add(flags, "Text Risk", "GENERIC_PRAISE", "High rating with very short, generic praise wording.", 10)

    if words:
        unique_ratio = len(set(words)) / len(words)
        if unique_ratio < 0.5:
            _add(flags, "Text Risk", "LOW_INFORMATION", "Review repeats the same words with little new information.", 6)

    if title and title in body and body.count(title) >= 2:
        _add(flags, "Text Risk", "TITLE_ECHO", "Title text is repeated multiple times inside the body.", 4)
    elif title and title.replace(" ", "") and title.replace(" ", "") * 2 in body.replace(" ", ""):
        _add(flags, "Text Risk", "TITLE_ECHO", "Title text is repeated back-to-back inside the body.", 4)

    if product and words:
        product_text = _normalize(f"{product.get('name', '')} {product.get('description', '')}")
        product_tokens = set(re.findall(r"[a-zA-Z']+", product_text))
        body_tokens = set(words)
        if product_tokens and body_tokens:
            jaccard = len(product_tokens & body_tokens) / len(product_tokens | body_tokens)
            if jaccard >= 0.6:
                _add(flags, "Text Risk", "COPY_OF_PRODUCT_CONTENT", "Review wording closely mirrors the product listing.", 8)

    duplicate_override = review.get("duplicate_text_override")
    duplicate_exists = False
    if duplicate_override is True:
        duplicate_exists = True
    elif duplicate_override is False:
        duplicate_exists = False
    else:
        duplicates = (
            db.table("reviews")
            .select("id, product_id, user_id")
            .ilike("body", body)
            .neq("user_id", review["user_id"])
            .limit(3)
            .execute()
        )
        duplicate_exists = bool(duplicates.data)
    if duplicate_exists:
        _add(flags, "Text Risk", "DUPLICATE_TEXT", "Same review text exists from another user.", 12)

    positive = sum(1 for word in words if word in POSITIVE_WORDS)
    negative = sum(1 for word in words if word in NEGATIVE_WORDS)
    if rating >= 4 and negative > positive:
        _add(flags, "Text Risk", "SENTIMENT_MISMATCH", "Negative wording does not match a high rating.", 8)
    if rating <= 2 and positive > negative:
        _add(flags, "Text Risk", "SENTIMENT_MISMATCH", "Positive wording does not match a low rating.", 8)

    return flags, clamp(sum(flag["score_impact"] for flag in flags), 45)


def profile_risk(review, profile, db):
    flags = []
    username = profile.get("username") or ""
    age_hours = _int_override(review, "account_age_hours_override")
    if age_hours is None:
        age_hours = _account_age_hours(profile)
    rating = int(review.get("rating", 0))
    extreme = rating in (1, 5)
    has_purchase = False
    purchase_override = review.get("verified_purchase_override")

    if age_hours is not None and age_hours < 72:
        _add(flags, "Profile Risk", "NEW_ACCOUNT", "User account is newly created.", 8)
    missing = [field for field in ["full_name", "phone", "address"] if not profile.get(field)]
    if len(missing) >= 2:
        _add(flags, "Profile Risk", "INCOMPLETE_PROFILE", "User profile has limited details.", 7)
    if re.fullmatch(r"user\d{4,}", username.lower()):
        _add(flags, "Profile Risk", "RANDOM_USERNAME", "Username follows a random account pattern.", 5)

    if purchase_override is True:
        has_purchase = True
    elif purchase_override is False:
        has_purchase = False
    else:
        purchases = (
            db.table("orders")
            .select("id, order_items!inner(product_id)")
            .eq("user_id", review["user_id"])
            .eq("order_items.product_id", review["product_id"])
            .execute()
        )
        has_purchase = bool(purchases.data)
    if not has_purchase:
        _add(flags, "Profile Risk", "NO_VERIFIED_PURCHASE", "User has no purchase history for this product.", 8)

    trust_score = _int_override(review, "trust_score_override")
    if trust_score is None:
        trust = db.table("user_trust_scores").select("*").eq("user_id", review["user_id"]).limit(1).execute()
        trust_score = trust.data[0].get("trust_score", 100) if trust.data else 100
    if trust_score < 31:
        _add(flags, "Profile Risk", "LOW_TRUST_USER", "Reviewer trust score is high risk.", 10)

    if age_hours is not None and age_hours < 24 and extreme:
        _add(
            flags,
            "Profile Risk",
            "FRESH_ACCOUNT_EXTREME_RATING",
            f"Account opened less than a day ago left a {rating}-star review.",
            12,
        )
    elif age_hours is not None and age_hours < 24 * 7 and extreme and not has_purchase:
        _add(
            flags,
            "Profile Risk",
            "NEW_ACCOUNT_NO_PURCHASE_EXTREME",
            "New account left an extreme rating without purchasing the product.",
            10,
        )

    return flags, clamp(sum(flag["score_impact"] for flag in flags), 40)


def behavior_risk(review, db):
    flags = []
    user_burst_count = _int_override(review, "review_burst_count_override")
    if user_burst_count is None:
        recent = (
            db.table("reviews")
            .select("id")
            .eq("user_id", review["user_id"])
            .gte("created_at", _now_iso_minus(60))
            .execute()
        )
        user_burst_count = len(recent.data or [])
    if user_burst_count >= 4:
        _add(flags, "Behavior Risk", "REVIEW_BURST", "User submitted many reviews in a short time.", 10)

    same_text_override = review.get("same_text_other_products_override")
    same_text_exists = False
    if same_text_override is True:
        same_text_exists = True
    elif same_text_override is False:
        same_text_exists = False
    else:
        same_text = (
            db.table("reviews")
            .select("id, product_id")
            .eq("user_id", review["user_id"])
            .ilike("body", _normalize(review.get("body", "")))
            .neq("product_id", review["product_id"])
            .execute()
        )
        same_text_exists = bool(same_text.data)
    if same_text_exists:
        _add(flags, "Behavior Risk", "SAME_REVIEW_MULTIPLE_PRODUCTS", "Same user reused this review on other products.", 10)

    product_cluster_count = _int_override(review, "product_review_cluster_count_override")
    if product_cluster_count is None:
        product_reviews = (
            db.table("reviews")
            .select("id")
            .eq("product_id", review["product_id"])
            .gte("created_at", _now_iso_minus(30))
            .execute()
        )
        product_cluster_count = len(product_reviews.data or [])
    if product_cluster_count >= 5:
        _add(flags, "Behavior Risk", "PRODUCT_REVIEW_CLUSTER", "Product received a review cluster in a short window.", 7)

    return flags, clamp(sum(flag["score_impact"] for flag in flags), 25)


def device_risk(review, db):
    flags = []
    fingerprint = (review.get("device_fingerprint") or "").strip()
    ip_hash = (review.get("ip_hash") or "").strip()
    user_id = review.get("user_id")

    shared_device_accounts = _int_override(review, "shared_device_accounts_override")
    device_burst_count = _int_override(review, "device_review_burst_count_override")
    shared_ip_accounts = _int_override(review, "shared_ip_accounts_override")

    if shared_device_accounts is not None and shared_device_accounts >= 2:
        _add(
            flags,
            "Device Risk",
            "MULTI_ACCOUNT_DEVICE",
            f"This device fingerprint has been used by {shared_device_accounts} different accounts in the last 7 days.",
            15,
        )
    elif fingerprint:
        device_rows = (
            db.table("reviews")
            .select("user_id")
            .eq("device_fingerprint", fingerprint)
            .gte("created_at", _now_iso_minus(60 * 24 * 7))
            .execute()
        )
        users = {row["user_id"] for row in (device_rows.data or []) if row.get("user_id") and row["user_id"] != user_id}
        if len(users) >= 2:
            _add(
                flags,
                "Device Risk",
                "MULTI_ACCOUNT_DEVICE",
                f"This device fingerprint has been used by {len(users) + 1} different accounts in the last 7 days.",
                15,
            )

        burst = (
            db.table("reviews")
            .select("id")
            .eq("device_fingerprint", fingerprint)
            .gte("created_at", _now_iso_minus(60))
            .execute()
        )
        if len(burst.data or []) >= 3:
            _add(
                flags,
                "Device Risk",
                "DEVICE_REVIEW_BURST",
                "This device posted several reviews in the last hour.",
                8,
            )

    if device_burst_count is not None and device_burst_count >= 3:
        _add(
            flags,
            "Device Risk",
            "DEVICE_REVIEW_BURST",
            "This device posted several reviews in the last hour.",
            8,
        )

    if shared_ip_accounts is not None and shared_ip_accounts >= 2:
        _add(
            flags,
            "Device Risk",
            "MULTI_ACCOUNT_IP",
            f"This IP has reviewed from {shared_ip_accounts} different accounts in the last 7 days.",
            12,
        )
    elif ip_hash:
        ip_rows = (
            db.table("reviews")
            .select("user_id")
            .eq("ip_hash", ip_hash)
            .gte("created_at", _now_iso_minus(60 * 24 * 7))
            .execute()
        )
        ip_users = {row["user_id"] for row in (ip_rows.data or []) if row.get("user_id") and row["user_id"] != user_id}
        if len(ip_users) >= 2:
            _add(
                flags,
                "Device Risk",
                "MULTI_ACCOUNT_IP",
                f"This IP has reviewed from {len(ip_users) + 1} different accounts in the last 7 days.",
                12,
            )

    return flags, clamp(sum(flag["score_impact"] for flag in flags), 25)


def rating_anomaly_risk(review, profile, db):
    flags = []
    rating = int(review.get("rating", 0))
    if rating not in [1, 5]:
        return flags, 0

    extreme_rating_burst = _int_override(review, "extreme_rating_burst_count_override")
    new_account_cluster = _int_override(review, "new_account_rating_cluster_count_override")

    reviews = None
    if extreme_rating_burst is None or new_account_cluster is None:
        reviews = (
            db.table("reviews")
            .select("id, rating, user_id, profiles!inner(created_at)")
            .eq("product_id", review["product_id"])
            .eq("rating", rating)
            .gte("created_at", _now_iso_minus(120))
            .execute()
        )

    if extreme_rating_burst is None:
        extreme_rating_burst = len((reviews.data or []) if reviews else [])
    if extreme_rating_burst >= 4:
        _add(flags, "Rating Anomaly Risk", "EXTREME_RATING_BURST", f"Product has a burst of {rating}-star reviews.", 8)

    if new_account_cluster is None:
        new_account_cluster = 0
        for row in reviews.data or []:
            created_at = row.get("profiles", {}).get("created_at")
            if created_at:
                try:
                    created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                    if (datetime.now(timezone.utc) - created).days < 7:
                        new_account_cluster += 1
                except ValueError:
                    continue
    if new_account_cluster >= 3:
        _add(flags, "Rating Anomaly Risk", "NEW_ACCOUNT_RATING_CLUSTER", "Several new accounts reviewed this product recently.", 9)

    return flags, clamp(sum(flag["score_impact"] for flag in flags), 15)


def classify(score):
    if score >= 55:
        return "High Risk", "quarantined"
    if score >= 25:
        return "Suspicious", "flagged"
    return "Genuine", "published"


def analyze_review(review, product=None, profile=None):
    # Backward compatibility: legacy callers pass (review, profile) without product.
    if profile is None and isinstance(product, dict) and "auth_user_id" in product:
        profile = product
        product = None
    db = get_supabase()
    profile = profile or {}
    all_flags = []
    category_scores = {}

    for name, fn in [
        ("text_risk", lambda: text_risk(review, db, product)),
        ("profile_risk", lambda: profile_risk(review, profile, db)),
        ("behavior_risk", lambda: behavior_risk(review, db)),
        ("device_risk", lambda: device_risk(review, db)),
        ("rating_anomaly_risk", lambda: rating_anomaly_risk(review, profile, db)),
    ]:
        flags, score = fn()
        all_flags.extend(flags)
        category_scores[name] = score

    final_score = min(sum(category_scores.values()), 100)
    label, status = classify(final_score)
    return {
        "risk_score": final_score,
        "risk_label": label,
        "status": status,
        "category_scores": category_scores,
        "flags": all_flags,
    }
