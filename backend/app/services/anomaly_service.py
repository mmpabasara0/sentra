from datetime import datetime, timedelta, timezone

from app.services.notification_service import notify_admins


def _now_minus(minutes):
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()


def _has_open_alert(db, product_id, alert_type, since_minutes=24 * 60):
    existing = (
        db.table("rating_anomaly_alerts")
        .select("id")
        .eq("product_id", product_id)
        .eq("alert_type", alert_type)
        .eq("status", "open")
        .gte("created_at", _now_minus(since_minutes))
        .limit(1)
        .execute()
    )
    return bool(existing.data)


def _insert_alert(db, product_id, alert_type, severity, description, metadata):
    if _has_open_alert(db, product_id, alert_type):
        return None
    payload = {
        "product_id": product_id,
        "alert_type": alert_type,
        "severity": severity,
        "description": description,
        "status": "open",
        "metadata": metadata or {},
    }
    inserted = db.table("rating_anomaly_alerts").insert(payload).execute()
    row = (inserted.data or [None])[0]
    if row:
        notify_admins(
            "rating_anomaly_raised",
            "Sentra raised a rating anomaly",
            description,
            f"/admin/anomalies",
            {"alert_id": row.get("id"), "product_id": product_id, "alert_type": alert_type, "severity": severity},
        )
    return row


def _check_five_star_burst(db, review):
    if int(review.get("rating", 0)) != 5:
        return None
    rows = (
        db.table("reviews")
        .select("id, user_id, profiles!inner(created_at)")
        .eq("product_id", review["product_id"])
        .eq("rating", 5)
        .gte("created_at", _now_minus(120))
        .execute()
    )
    new_account_reviews = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    for row in rows.data or []:
        created_at = (row.get("profiles") or {}).get("created_at")
        if not created_at:
            continue
        try:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except ValueError:
            continue
        if created >= cutoff:
            new_account_reviews.append(row)
    if len(new_account_reviews) < 3:
        return None
    return _insert_alert(
        db,
        review["product_id"],
        "five_star_burst",
        "high",
        f"{len(new_account_reviews)} five-star reviews from accounts under 7 days old were posted in the last 2 hours.",
        {
            "trigger_review_ids": [r["id"] for r in new_account_reviews],
            "profile_ids": list({r["user_id"] for r in new_account_reviews if r.get("user_id")}),
            "window_minutes": 120,
        },
    )


def _check_multi_account_device(db, review):
    fingerprint = (review.get("device_fingerprint") or "").strip()
    if not fingerprint:
        return None
    rows = (
        db.table("reviews")
        .select("id, user_id, product_id")
        .eq("device_fingerprint", fingerprint)
        .gte("created_at", _now_minus(60 * 24))
        .execute()
    )
    user_ids = {row["user_id"] for row in (rows.data or []) if row.get("user_id")}
    product_ids = {row["product_id"] for row in (rows.data or []) if row.get("product_id")}
    if len(rows.data or []) < 3 or len(user_ids) < 2:
        return None
    return _insert_alert(
        db,
        review["product_id"],
        "multi_account_device",
        "high",
        f"One device fingerprint posted {len(rows.data)} reviews across {len(user_ids)} accounts in the last 24 hours.",
        {
            "trigger_review_ids": [r["id"] for r in (rows.data or [])],
            "profile_ids": list(user_ids),
            "product_ids": list(product_ids),
            "device_fingerprint": fingerprint,
        },
    )


def _check_verified_purchase_gap(db, review):
    rows = (
        db.table("reviews")
        .select("id, is_verified_purchase")
        .eq("product_id", review["product_id"])
        .gte("created_at", _now_minus(60 * 24 * 7))
        .execute()
    )
    items = rows.data or []
    if len(items) < 5:
        return None
    unverified = [row for row in items if not row.get("is_verified_purchase")]
    if len(unverified) / len(items) < 0.8:
        return None
    return _insert_alert(
        db,
        review["product_id"],
        "verified_purchase_gap",
        "medium",
        f"{len(unverified)} of {len(items)} reviews on this product in the last 7 days are not from verified purchases.",
        {
            "trigger_review_ids": [r["id"] for r in unverified[:25]],
            "unverified_count": len(unverified),
            "total_count": len(items),
        },
    )


def evaluate_review_anomalies(review, profile, db):
    raised = []
    for fn in (_check_five_star_burst, _check_multi_account_device, _check_verified_purchase_gap):
        try:
            alert = fn(db, review)
            if alert:
                raised.append(alert)
        except Exception:
            continue
    return raised
