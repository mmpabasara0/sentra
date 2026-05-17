from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request

from app.sentra_engine.scoring import analyze_review
from app.sentra_engine.seller_scoring import analyze_seller_application
from app.services.notification_service import notify_profile, notify_seller_id
from app.services.trust_service import calculate_trust_score
from app.utils.auth import current_profile, require_admin
from app.config.settings import Settings
from app.utils.responses import error, ok
from app.utils.supabase_client import get_supabase

admin_bp = Blueprint("admin", __name__)


def _now_minus_minutes(minutes):
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()


def _account_age_days(created_at):
    if not created_at:
        return None
    try:
        created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except ValueError:
        return None
    return max((datetime.now(timezone.utc) - created).days, 0)


def _annotate_review_signals(db, reviews):
    if not reviews:
        return reviews

    fingerprints = {(r.get("device_fingerprint") or "").strip() for r in reviews}
    fingerprints.discard("")
    ip_hashes = {(r.get("ip_hash") or "").strip() for r in reviews}
    ip_hashes.discard("")

    fp_users = defaultdict(set)
    if fingerprints:
        rows = (
            db.table("reviews")
            .select("user_id, device_fingerprint")
            .in_("device_fingerprint", list(fingerprints))
            .execute()
        )
        for row in rows.data or []:
            if row.get("user_id"):
                fp_users[row["device_fingerprint"]].add(row["user_id"])

    ip_users = defaultdict(set)
    if ip_hashes:
        rows = (
            db.table("reviews")
            .select("user_id, ip_hash")
            .in_("ip_hash", list(ip_hashes))
            .execute()
        )
        for row in rows.data or []:
            if row.get("user_id"):
                ip_users[row["ip_hash"]].add(row["user_id"])

    annotated = []
    for r in reviews:
        profile = r.get("profiles") or {}
        fp = (r.get("device_fingerprint") or "").strip()
        ip = (r.get("ip_hash") or "").strip()
        signals = {
            "account_age_days": _account_age_days(profile.get("created_at")),
            "verified_purchase": bool(r.get("is_verified_purchase")),
            "device_cluster_size": len(fp_users.get(fp, set())) if fp else 0,
            "ip_cluster_size": len(ip_users.get(ip, set())) if ip else 0,
            "device_fingerprint_short": fp[:8] if fp else "",
            "ip_hash_short": ip[:8] if ip else "",
        }
        annotated.append({**r, "signals": signals})
    return annotated


def _submission_context(db, review):
    profile = review.get("profiles") or {}
    fingerprint = (review.get("device_fingerprint") or "").strip()
    ip_hash = (review.get("ip_hash") or "").strip()

    co_users = []
    if fingerprint or ip_hash:
        peer_rows = (
            db.table("reviews")
            .select("user_id, device_fingerprint, ip_hash, profiles(username, full_name)")
            .gte("created_at", _now_minus_minutes(60 * 24 * 7))
            .execute()
        )
        seen = set()
        for row in peer_rows.data or []:
            uid = row.get("user_id")
            if not uid or uid == review.get("user_id") or uid in seen:
                continue
            shared = []
            if fingerprint and (row.get("device_fingerprint") or "").strip() == fingerprint:
                shared.append("device")
            if ip_hash and (row.get("ip_hash") or "").strip() == ip_hash:
                shared.append("ip")
            if not shared:
                continue
            seen.add(uid)
            prof = row.get("profiles") or {}
            co_users.append(
                {
                    "user_id": uid,
                    "username": prof.get("username") or "",
                    "full_name": prof.get("full_name") or "",
                    "shared": shared,
                }
            )

    return {
        "device_fingerprint": fingerprint,
        "device_fingerprint_short": fingerprint[:8] if fingerprint else "",
        "ip_hash": ip_hash,
        "ip_hash_short": ip_hash[:8] if ip_hash else "",
        "user_agent": review.get("user_agent") or "",
        "account_age_days": _account_age_days(profile.get("created_at")),
        "verified_purchase": bool(review.get("is_verified_purchase")),
        "device_co_users": co_users,
    }


def _compute_fraud_metrics(db):
    since_24h = _now_minus_minutes(60 * 24)
    since_7d = _now_minus_minutes(60 * 24 * 7)

    extreme_24h = (
        db.table("reviews")
        .select("id, rating, profiles!inner(created_at)")
        .in_("rating", [1, 5])
        .gte("created_at", since_24h)
        .execute()
    )
    new_account_extreme = 0
    cutoff_new = datetime.now(timezone.utc) - timedelta(days=7)
    for row in extreme_24h.data or []:
        created_at = (row.get("profiles") or {}).get("created_at")
        if not created_at:
            continue
        try:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except ValueError:
            continue
        if created >= cutoff_new:
            new_account_extreme += 1

    fp_rows = (
        db.table("reviews")
        .select("user_id, device_fingerprint, profiles(username, full_name)")
        .neq("device_fingerprint", "")
        .gte("created_at", since_7d)
        .execute()
    )
    by_fp = defaultdict(set)
    fp_profiles = defaultdict(dict)
    for row in fp_rows.data or []:
        fp = (row.get("device_fingerprint") or "").strip()
        uid = row.get("user_id")
        if not fp or not uid:
            continue
        by_fp[fp].add(uid)
        prof = row.get("profiles") or {}
        if uid not in fp_profiles[fp]:
            fp_profiles[fp][uid] = {
                "user_id": uid,
                "username": prof.get("username") or "",
                "full_name": prof.get("full_name") or "",
            }
    multi_devices = [(fp, users) for fp, users in by_fp.items() if len(users) >= 2]
    multi_devices.sort(key=lambda item: len(item[1]), reverse=True)

    top_clusters = []
    for fp, users in multi_devices[:5]:
        top_clusters.append(
            {
                "device_fingerprint": fp,
                "device_fingerprint_short": fp[:8],
                "user_count": len(users),
                "members": list(fp_profiles[fp].values()),
            }
        )

    ip_rows = (
        db.table("reviews")
        .select("user_id, ip_hash")
        .neq("ip_hash", "")
        .gte("created_at", since_7d)
        .execute()
    )
    by_ip = defaultdict(set)
    for row in ip_rows.data or []:
        ip = (row.get("ip_hash") or "").strip()
        uid = row.get("user_id")
        if ip and uid:
            by_ip[ip].add(uid)
    multi_ips = [(ip, users) for ip, users in by_ip.items() if len(users) >= 2]

    return {
        "new_account_extreme_reviews_24h": new_account_extreme,
        "multi_account_devices_7d": len(multi_devices),
        "multi_account_ips_7d": len(multi_ips),
        "top_device_clusters": top_clusters,
    }


@admin_bp.get("/fraud/overview")
@require_admin
def fraud_overview():
    db = get_supabase()
    metrics = _compute_fraud_metrics(db)

    recent_alerts = (
        db.table("rating_anomaly_alerts")
        .select("id, alert_type, severity, description, status, metadata, created_at, products(name)")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    new_account_extreme = (
        db.table("reviews")
        .select("id, rating, body, status, risk_score, risk_label, created_at, products(name), profiles(username, full_name, created_at)")
        .in_("rating", [1, 5])
        .gte("created_at", _now_minus_minutes(60 * 24))
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    fresh = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    for row in new_account_extreme.data or []:
        created_at = (row.get("profiles") or {}).get("created_at")
        if not created_at:
            continue
        try:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except ValueError:
            continue
        if created >= cutoff:
            fresh.append(row)

    return ok(
        {
            "metrics": {
                "new_account_extreme_reviews_24h": metrics["new_account_extreme_reviews_24h"],
                "multi_account_devices_7d": metrics["multi_account_devices_7d"],
                "multi_account_ips_7d": metrics["multi_account_ips_7d"],
            },
            "device_clusters": metrics["top_device_clusters"],
            "recent_alerts": recent_alerts.data or [],
            "new_account_extreme_reviews": fresh,
        }
    )


@admin_bp.get("/dashboard")
@require_admin
def dashboard():
    db = get_supabase()
    profiles = db.table("profiles").select("id").execute()
    products = db.table("products").select("id").execute()
    reviews = db.table("reviews").select("id, status").execute()
    trust = db.table("user_trust_scores").select("id").eq("trust_label", "High Risk Reviewer").execute()
    alerts = db.table("rating_anomaly_alerts").select("id").eq("status", "open").execute()
    seller_applications = db.table("seller_applications").select("id").eq("status", "pending").execute()
    pending_products = db.table("products").select("id").eq("approval_status", "pending_review").execute()
    flagged = [r for r in reviews.data or [] if r.get("status") in ["flagged", "quarantined"]]

    fraud = _compute_fraud_metrics(db)

    return ok(
        {
            "cards": {
                "total_users": len(profiles.data or []),
                "total_products": len(products.data or []),
                "total_reviews": len(reviews.data or []),
                "flagged_reviews": len(flagged),
                "high_risk_users": len(trust.data or []),
                "rating_alerts": len(alerts.data or []),
                "seller_applications": len(seller_applications.data or []),
                "pending_products": len(pending_products.data or []),
                "new_account_extreme_reviews_24h": fraud["new_account_extreme_reviews_24h"],
                "multi_account_devices_7d": fraud["multi_account_devices_7d"],
            }
        }
    )


@admin_bp.get("/reviews/flagged")
@require_admin
def flagged_reviews():
    db = get_supabase()
    include_borderline = (request.args.get("include_borderline") or "").lower() in ("1", "true", "yes")

    res = (
        db.table("reviews")
        .select("*, profiles(full_name, username, created_at), products(name), review_flags(*)")
        .in_("status", ["flagged", "quarantined"])
        .order("risk_score", desc=True)
        .execute()
    )
    rows = list(res.data or [])

    if include_borderline:
        borderline = (
            db.table("reviews")
            .select("*, profiles(full_name, username, created_at), products(name), review_flags(*)")
            .eq("status", "published")
            .gte("risk_score", 15)
            .order("risk_score", desc=True)
            .limit(40)
            .execute()
        )
        rows.extend(borderline.data or [])

    return ok({"reviews": _annotate_review_signals(db, rows)})


@admin_bp.get("/reviews/<review_id>/risk-report")
@require_admin
def review_report(review_id):
    db = get_supabase()
    review = (
        db.table("reviews")
        .select("*, profiles(*), products(*), review_flags(*)")
        .eq("id", review_id)
        .single()
        .execute()
    )
    review_data = review.data or {}
    trust = (
        db.table("user_trust_scores")
        .select("*")
        .eq("user_id", review_data.get("user_id"))
        .limit(1)
        .execute()
    )
    context = _submission_context(db, review_data) if review_data else None
    return ok(
        {
            "review": review_data,
            "trust": trust.data[0] if trust.data else None,
            "context": context,
        }
    )


def _moderate(review_id, action):
    status = {"approve": "approved", "reject": "rejected", "quarantine": "quarantined"}[action]
    db = get_supabase()
    updated = db.table("reviews").update({"status": status}).eq("id", review_id).execute()
    notes = (request.get_json(silent=True) or {}).get("notes", "")
    db.table("moderation_logs").insert(
        {
            "admin_id": current_profile()["id"],
            "target_type": "review",
            "target_id": review_id,
            "action": action,
            "notes": notes,
        }
    ).execute()
    if updated.data:
        calculate_trust_score(updated.data[0]["user_id"])
        if action in ["approve", "reject"]:
            notify_profile(
                updated.data[0]["user_id"],
                "customer",
                f"review_{status}",
                "Review moderation updated",
                f"Your review was {status}.",
                "/dashboard",
                {"review_id": review_id, "status": status},
            )
    return ok({"review": updated.data[0] if updated.data else None})


@admin_bp.post("/reviews/<review_id>/approve")
@require_admin
def approve_review(review_id):
    return _moderate(review_id, "approve")


@admin_bp.post("/reviews/<review_id>/reject")
@require_admin
def reject_review(review_id):
    return _moderate(review_id, "reject")


@admin_bp.post("/reviews/<review_id>/quarantine")
@require_admin
def quarantine_review(review_id):
    return _moderate(review_id, "quarantine")


@admin_bp.get("/users/suspicious")
@require_admin
def suspicious_users():
    res = (
        get_supabase()
        .table("user_trust_scores")
        .select("*, profiles(*)")
        .lte("trust_score", 70)
        .order("trust_score")
        .execute()
    )
    return ok({"users": res.data or []})


def _admin_log(target_type, target_id, action, notes=""):
    get_supabase().table("moderation_logs").insert(
        {
            "admin_id": current_profile()["id"],
            "target_type": target_type,
            "target_id": target_id,
            "action": action,
            "notes": notes,
        }
    ).execute()


def _seller_score_label(score):
    if score is None:
        return "Not Calculated"
    if score >= 80:
        return "Strong"
    if score >= 60:
        return "Needs Review"
    return "At Risk"


def _seller_score_tone(score):
    if score is None:
        return "neutral"
    if score >= 80:
        return "good"
    if score >= 60:
        return "warn"
    return "bad"


def _seller_score_monitor(seller, application):
    if not seller and not application:
        return None

    seller_score = seller.get("trust_score") if seller else None
    application_score = application.get("risk_score") if application else None
    active_score = seller_score if seller_score is not None else application_score
    reasons = application.get("risk_reasons") if application else []
    documents = application.get("seller_documents") if application else []
    required_docs = {"nic", "utility_bill"}
    uploaded_docs = {doc.get("document_type") for doc in documents or []}
    score_gap = None
    if seller_score is not None and application_score is not None:
        score_gap = abs(int(seller_score) - int(application_score))

    return {
        "score": active_score,
        "label": _seller_score_label(active_score),
        "tone": _seller_score_tone(active_score),
        "seller_score": seller_score,
        "application_score": application_score,
        "application_label": application.get("risk_label") if application else "",
        "application_id": application.get("id") if application else None,
        "application_status": application.get("status") if application else None,
        "store_name": (seller or application or {}).get("store_name") or "",
        "reasons": reasons or [],
        "documents_uploaded": len(documents or []),
        "missing_documents": sorted(required_docs - uploaded_docs),
        "score_gap": score_gap or 0,
        "score_synced": score_gap in [None, 0],
        "updated_at": (seller or {}).get("updated_at") or (application or {}).get("reviewed_at") or (application or {}).get("submitted_at"),
    }


def _serialize_admin_user(profile, trust_by_user, seller_by_profile, application_by_profile):
    trust = trust_by_user.get(profile["id"])
    seller = seller_by_profile.get(profile["id"])
    application = application_by_profile.get(profile["id"])
    return {
        "id": profile["id"],
        "full_name": profile.get("full_name") or "",
        "username": profile.get("username") or "",
        "role": profile.get("role") or "customer",
        "status": profile.get("status") or "active",
        "phone": profile.get("phone") or "",
        "address": profile.get("address") or "",
        "created_at": profile.get("created_at"),
        "updated_at": profile.get("updated_at"),
        "trust": trust
        or {
            "trust_score": 100,
            "trust_label": "No Risk History",
            "approved_reviews": 0,
            "flagged_reviews": 0,
            "rejected_reviews": 0,
        },
        "seller": seller,
        "seller_score": _seller_score_monitor(seller, application),
    }


def _is_deleted_profile(profile):
    username = profile.get("username") or ""
    return profile.get("full_name") == "[deleted]" or username.startswith("deleted_")


def _latest_applications_by_profile(rows):
    latest = {}
    for row in rows:
        profile_id = row.get("profile_id")
        if profile_id and profile_id not in latest:
            latest[profile_id] = row
    return latest


def _recalculate_seller_application_score(db, application, profile=None, sync_seller=True):
    if not application:
        return None
    if not profile:
        profile_res = db.table("profiles").select("*").eq("id", application["profile_id"]).single().execute()
        profile = profile_res.data
    if not profile:
        return None

    documents = application.get("seller_documents")
    if documents is None:
        docs_res = db.table("seller_documents").select("*").eq("application_id", application["id"]).execute()
        documents = docs_res.data or []

    analysis = analyze_seller_application(application, profile, documents)
    score_payload = {
        "risk_score": analysis["risk_score"],
        "risk_label": analysis["risk_label"],
        "risk_reasons": analysis["reasons"],
    }
    updated_application = (
        db.table("seller_applications")
        .update(score_payload)
        .eq("id", application["id"])
        .execute()
        .data
        or []
    )
    next_application = {**application, **score_payload, "seller_documents": documents}
    if updated_application:
        next_application = {**next_application, **updated_application[0], "seller_documents": documents}

    if sync_seller:
        seller = db.table("sellers").select("id").eq("profile_id", application["profile_id"]).limit(1).execute()
        if seller.data:
            db.table("sellers").update(
                {
                    "trust_score": analysis["risk_score"],
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", seller.data[0]["id"]).execute()

    return {"application": next_application, "analysis": analysis}


@admin_bp.get("/users")
@require_admin
def all_users():
    db = get_supabase()
    profiles = (
        db.table("profiles")
        .select("id, full_name, username, role, phone, address, status, created_at, updated_at")
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    profiles = [profile for profile in profiles if not _is_deleted_profile(profile)]
    trust_rows = db.table("user_trust_scores").select("*").execute().data or []
    seller_rows = (
        db.table("sellers")
        .select("id, profile_id, store_name, slug, status, trust_score, created_at, updated_at")
        .execute()
        .data
        or []
    )
    application_rows = (
        db.table("seller_applications")
        .select("*, seller_documents(*)")
        .order("submitted_at", desc=True)
        .execute()
        .data
        or []
    )
    trust_by_user = {row["user_id"]: row for row in trust_rows}
    seller_by_profile = {row["profile_id"]: row for row in seller_rows}
    application_by_profile = _latest_applications_by_profile(application_rows)
    return ok({"users": [_serialize_admin_user(p, trust_by_user, seller_by_profile, application_by_profile) for p in profiles]})


@admin_bp.get("/users/<profile_id>")
@require_admin
def user_detail(profile_id):
    db = get_supabase()
    profile_res = (
        db.table("profiles")
        .select("id, full_name, username, role, phone, address, status, created_at, updated_at")
        .eq("id", profile_id)
        .single()
        .execute()
    )
    profile = profile_res.data
    if not profile:
        return error("User was not found.", 404, "not_found")

    trust = db.table("user_trust_scores").select("*").eq("user_id", profile_id).limit(1).execute().data or []
    seller = db.table("sellers").select("*").eq("profile_id", profile_id).limit(1).execute().data or []
    applications = (
        db.table("seller_applications")
        .select("*, seller_documents(*)")
        .eq("profile_id", profile_id)
        .order("submitted_at", desc=True)
        .execute()
        .data
        or []
    )
    seller_row = seller[0] if seller else None
    seller_products = []
    seller_reviews = []
    if seller_row:
        seller_products = (
            db.table("products")
            .select("id, name, approval_status, product_risk_score, product_risk_label, product_risk_reasons, created_at")
            .eq("seller_id", seller_row["id"])
            .order("created_at", desc=True)
            .limit(8)
            .execute()
            .data
            or []
        )
        product_ids = [product["id"] for product in seller_products if product.get("id")]
        if product_ids:
            seller_reviews = (
                db.table("reviews")
                .select("id, title, status, risk_score, risk_label, created_at, products(name)")
                .in_("product_id", product_ids)
                .order("risk_score", desc=True)
                .limit(8)
                .execute()
                .data
                or []
            )

    logs = (
        db.table("moderation_logs")
        .select("id, target_type, target_id, action, notes, created_at, profiles(username, full_name)")
        .or_(f"target_id.eq.{profile_id},target_id.eq.{seller_row['id'] if seller_row else profile_id}")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
        .data
        or []
    )

    serialized = _serialize_admin_user(
        profile,
        {profile_id: trust[0]} if trust else {},
        {profile_id: seller_row} if seller_row else {},
        _latest_applications_by_profile(applications),
    )
    return ok(
        {
            "user": serialized,
            "applications": applications,
            "seller_products": seller_products,
            "seller_reviews": seller_reviews,
            "moderation_logs": logs,
        }
    )


@admin_bp.post("/users/<profile_id>/seller-score/recalculate")
@require_admin
def recalculate_user_seller_score(profile_id):
    db = get_supabase()
    profile_res = db.table("profiles").select("*").eq("id", profile_id).single().execute()
    profile = profile_res.data
    if not profile:
        return error("User was not found.", 404, "not_found")
    applications = (
        db.table("seller_applications")
        .select("*, seller_documents(*)")
        .eq("profile_id", profile_id)
        .order("submitted_at", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not applications:
        return error("This user does not have a seller application to recalculate.", 404, "not_found")

    result = _recalculate_seller_application_score(db, applications[0], profile, sync_seller=True)
    _admin_log("seller_application", applications[0]["id"], "recalculate_seller_score", "Seller score recalculated from admin user monitoring.")
    return ok(result or {})


@admin_bp.post("/users/<profile_id>/status")
@require_admin
def update_user_status(profile_id):
    body = request.get_json(silent=True) or {}
    status = body.get("status")
    notes = body.get("notes", "")
    if status not in ["active", "monitored", "restricted"]:
        return error("Status must be active, monitored, or restricted.", 422, "validation_error")
    if profile_id == current_profile()["id"] and status == "restricted":
        return error("You cannot restrict your own admin account.", 422, "self_lockout")

    updated = (
        get_supabase()
        .table("profiles")
        .update({"status": status, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", profile_id)
        .execute()
    )
    if not updated.data:
        return error("User was not found.", 404, "not_found")
    _admin_log("user", profile_id, f"set_status_{status}", notes)
    return ok({"user": updated.data[0]})


@admin_bp.post("/users/<profile_id>/role")
@require_admin
def update_user_role(profile_id):
    body = request.get_json(silent=True) or {}
    role = body.get("role")
    notes = body.get("notes", "")
    if role not in ["customer", "seller", "admin"]:
        return error("Role must be customer, seller, or admin.", 422, "validation_error")
    if profile_id == current_profile()["id"] and role != "admin":
        return error("You cannot remove your own admin role.", 422, "self_lockout")

    updated = (
        get_supabase()
        .table("profiles")
        .update({"role": role, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", profile_id)
        .execute()
    )
    if not updated.data:
        return error("User was not found.", 404, "not_found")
    _admin_log("user", profile_id, f"set_role_{role}", notes)
    return ok({"user": updated.data[0]})


@admin_bp.post("/users/<profile_id>/remove-seller")
@require_admin
def remove_seller_access(profile_id):
    body = request.get_json(silent=True) or {}
    notes = body.get("notes", "")
    db = get_supabase()
    seller = db.table("sellers").select("*").eq("profile_id", profile_id).limit(1).execute()
    if not seller.data:
        return error("This user does not have an active seller record.", 404, "not_found")

    now = datetime.now(timezone.utc).isoformat()
    seller_update = (
        db.table("sellers")
        .update({"status": "suspended", "updated_at": now})
        .eq("profile_id", profile_id)
        .execute()
    )
    profile_update = (
        db.table("profiles")
        .update({"role": "customer", "updated_at": now})
        .eq("id", profile_id)
        .execute()
    )
    _admin_log("seller", seller.data[0]["id"], "remove_seller_access", notes)
    return ok(
        {
            "seller": seller_update.data[0] if seller_update.data else None,
            "user": profile_update.data[0] if profile_update.data else None,
        }
    )


@admin_bp.post("/users/<profile_id>/restore-seller")
@require_admin
def restore_seller_access(profile_id):
    body = request.get_json(silent=True) or {}
    notes = body.get("notes", "")
    db = get_supabase()
    seller = db.table("sellers").select("*").eq("profile_id", profile_id).limit(1).execute()
    if not seller.data:
        return error("This user does not have a seller record to restore.", 404, "not_found")

    now = datetime.now(timezone.utc).isoformat()
    seller_update = (
        db.table("sellers")
        .update({"status": "active", "updated_at": now})
        .eq("profile_id", profile_id)
        .execute()
    )
    profile_update = (
        db.table("profiles")
        .update({"role": "seller", "updated_at": now})
        .eq("id", profile_id)
        .execute()
    )
    _admin_log("seller", seller.data[0]["id"], "restore_seller_access", notes)
    return ok(
        {
            "seller": seller_update.data[0] if seller_update.data else None,
            "user": profile_update.data[0] if profile_update.data else None,
        }
    )


@admin_bp.delete("/users/<profile_id>")
@require_admin
def delete_user(profile_id):
    body = request.get_json(silent=True) or {}
    notes = body.get("notes", "")
    admin = current_profile()
    if not admin:
        return error("Unauthorized.", 403, "unauthorized")

    db = get_supabase()
    profile_res = db.table("profiles").select("id, auth_user_id, username, role").eq("id", profile_id).single().execute()
    profile = profile_res.data
    if not profile:
        return error("User not found.", 404, "not_found")

    if profile.get("role") == "admin":
        return error("Admin accounts cannot be deleted.", 403, "forbidden")

    if profile_id == admin.get("id"):
        return error("You cannot delete your own account.", 403, "forbidden")

    username = profile.get("username", profile_id)
    log_notes = notes or f"Admin deleted account @{username}"
    auth_user_id = profile.get("auth_user_id")

    try:
        if auth_user_id:
            db.auth.admin.delete_user(auth_user_id)
        db.table("profiles").delete().eq("id", profile_id).execute()
    except Exception:
        # Fallback: hard-ban and anonymize if auth deletion fails
        now = datetime.now(timezone.utc).isoformat()
        db.table("profiles").update({
            "status": "restricted",
            "full_name": "[deleted]",
            "username": f"deleted_{profile_id[:8]}",
            "phone": None,
            "address": None,
            "updated_at": now,
        }).eq("id", profile_id).execute()
        _admin_log("user", profile_id, "delete_user_fallback", log_notes)
        return ok({"message": "Account anonymized and restricted.", "deleted": False})

    _admin_log("user", admin.get("id", profile_id), "delete_user", log_notes)
    return ok({"message": f"Account @{username} has been permanently deleted.", "deleted": True})


@admin_bp.get("/products/anomalies")
@require_admin
def anomalies():
    res = (
        get_supabase()
        .table("rating_anomaly_alerts")
        .select("*, products(name)")
        .order("created_at", desc=True)
        .execute()
    )
    return ok({"alerts": res.data or []})


@admin_bp.get("/moderation-logs")
@require_admin
def moderation_logs():
    res = (
        get_supabase()
        .table("moderation_logs")
        .select("*, profiles(full_name, username)")
        .order("created_at", desc=True)
        .execute()
    )
    return ok({"logs": res.data or []})


@admin_bp.get("/activity-logs")
@require_admin
def activity_logs():
    res = (
        get_supabase()
        .table("activity_logs")
        .select("*, profiles(full_name, username)")
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )
    return ok({"logs": res.data or []})


@admin_bp.get("/seller-applications")
@require_admin
def seller_applications():
    res = (
        get_supabase()
        .table("seller_applications")
        .select("*, profiles(full_name, username, phone), seller_documents(*)")
        .order("submitted_at", desc=True)
        .execute()
    )
    return ok({"applications": res.data or []})


@admin_bp.post("/seller-applications/recalculate-scores")
@require_admin
def recalculate_all_seller_application_scores():
    db = get_supabase()
    applications = (
        db.table("seller_applications")
        .select("*, seller_documents(*)")
        .order("submitted_at", desc=True)
        .execute()
        .data
        or []
    )
    recalculated = []
    for application in applications:
        result = _recalculate_seller_application_score(db, application, sync_seller=True)
        if result:
            recalculated.append(result["application"])
    _admin_log("seller_application", current_profile()["id"], "recalculate_all_seller_scores", f"Recalculated {len(recalculated)} seller application scores.")
    return ok({"count": len(recalculated), "applications": recalculated})


@admin_bp.get("/seller-applications/<application_id>")
@require_admin
def seller_application_detail(application_id):
    res = (
        get_supabase()
        .table("seller_applications")
        .select("*, profiles(*), seller_documents(*)")
        .eq("id", application_id)
        .single()
        .execute()
    )
    return ok({"application": res.data})


def _seller_slug(store_name, application_id):
    import re

    base = re.sub(r"[^a-z0-9]+", "-", (store_name or "seller-store").lower()).strip("-") or "seller-store"
    return f"{base}-{application_id[:6]}"


def _log_admin_action(target_type, target_id, action, notes=""):
    get_supabase().table("moderation_logs").insert(
        {
            "admin_id": current_profile()["id"],
            "target_type": target_type,
            "target_id": target_id,
            "action": action,
            "notes": notes,
        }
    ).execute()


@admin_bp.post("/seller-applications/<application_id>/approve")
@require_admin
def approve_seller_application(application_id):
    db = get_supabase()
    app_res = db.table("seller_applications").select("*").eq("id", application_id).single().execute()
    application = app_res.data
    if not application:
        return error("Seller application was not found.", 404, "not_found")
    recalculated = _recalculate_seller_application_score(db, application, sync_seller=False)
    if recalculated:
        application = recalculated["application"]

    seller_payload = {
        "profile_id": application["profile_id"],
        "store_name": application["store_name"],
        "slug": _seller_slug(application["store_name"], application_id),
        "business_or_personal_name": application["business_or_personal_name"],
        "email": application["email"],
        "phone": application["phone"],
        "address": application["address"],
        "bank_name": application.get("bank_name") or "",
        "account_holder": application.get("account_holder") or "",
        "account_number": application.get("account_number") or "",
        "account_number_last4": application.get("account_number_last4") or "",
        "payment_notes": application.get("payment_notes") or "",
        "status": "active",
        "trust_score": int(application.get("risk_score") or 75),
    }
    existing = db.table("sellers").select("id").eq("profile_id", application["profile_id"]).limit(1).execute()
    if existing.data:
        seller = db.table("sellers").update(seller_payload).eq("id", existing.data[0]["id"]).execute().data[0]
    else:
        seller = db.table("sellers").insert(seller_payload).execute().data[0]

    updated = (
        db.table("seller_applications")
        .update(
            {
                "status": "approved",
                "admin_notes": (request.get_json(silent=True) or {}).get("notes", ""),
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", application_id)
        .execute()
    )
    db.table("seller_documents").update({"verification_status": "verified"}).eq("application_id", application_id).execute()
    db.table("profiles").update({"role": "seller"}).eq("id", application["profile_id"]).execute()
    _log_admin_action("seller_application", application_id, "approve", (request.get_json(silent=True) or {}).get("notes", ""))
    notify_profile(
        application["profile_id"],
        "seller",
        "seller_application_approved",
        "Seller application approved",
        f"{application['store_name']} is approved. Seller Studio is ready.",
        "/seller/dashboard",
        {"application_id": application_id, "seller_id": seller["id"]},
    )
    return ok({"application": updated.data[0] if updated.data else None, "seller": seller})


def _update_seller_application_status(application_id, status, action):
    body = request.get_json(silent=True) or {}
    app_res = get_supabase().table("seller_applications").select("*").eq("id", application_id).limit(1).execute()
    application = app_res.data[0] if app_res.data else None
    updated = (
        get_supabase()
        .table("seller_applications")
        .update(
            {
                "status": status,
                "admin_notes": body.get("notes", ""),
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", application_id)
        .execute()
    )
    _log_admin_action("seller_application", application_id, action, body.get("notes", ""))
    if application:
        notify_profile(
            application["profile_id"],
            "seller",
            f"seller_application_{status}",
            "Seller application update",
            body.get("notes") or f"Your seller application was marked {status.replace('_', ' ')}.",
            "/seller/apply",
            {"application_id": application_id, "status": status},
        )
    return ok({"application": updated.data[0] if updated.data else None})


@admin_bp.post("/seller-applications/<application_id>/reject")
@require_admin
def reject_seller_application(application_id):
    return _update_seller_application_status(application_id, "rejected", "reject")


@admin_bp.post("/seller-applications/<application_id>/request-changes")
@require_admin
def request_seller_application_changes(application_id):
    return _update_seller_application_status(application_id, "changes_requested", "request_changes")


@admin_bp.get("/seller-documents/<document_id>/download")
@require_admin
def seller_document_download(document_id):
    doc_res = get_supabase().table("seller_documents").select("*").eq("id", document_id).single().execute()
    document = doc_res.data
    if not document:
        return error("Seller document was not found.", 404, "not_found")

    file_path = document.get("file_path", "")
    if not file_path:
        return error("Seller document has no file path.", 400, "no_file_path")

    try:
        db = get_supabase()
        res = db.storage.from_("seller-documents").create_signed_url(file_path, 300)
        signed_url = None
        if isinstance(res, dict):
            signed_url = res.get("signedURL") or res.get("signedUrl") or res.get("signed_url")
        elif hasattr(res, "signed_url"):
            signed_url = res.signed_url

        if not signed_url:
            return error("Storage did not return a document link.", 502, "storage_sign_failed")

        settings = Settings()
        if signed_url.startswith("/storage/v1"):
            signed_url = f"{settings.supabase_url.rstrip('/')}{signed_url}"
        elif signed_url.startswith("/"):
            signed_url = f"{settings.supabase_url.rstrip('/')}/storage/v1{signed_url}"

        return ok({"document": document, "signed_url": signed_url})
    except Exception:
        return error("Could not create a secure document link.", 502, "storage_sign_failed")


@admin_bp.get("/products/pending")
@require_admin
def pending_products():
    res = (
        get_supabase()
        .table("products")
        .select("*, sellers(store_name, trust_score), seller_product_reviews(*)")
        .eq("approval_status", "pending_review")
        .order("submitted_at", desc=True)
        .execute()
    )
    return ok({"products": res.data or []})


@admin_bp.get("/products/<product_id>")
@require_admin
def admin_product_detail(product_id):
    product_res = (
        get_supabase()
        .table("products")
        .select("*, sellers(store_name, trust_score, status), seller_product_reviews(*)")
        .eq("id", product_id)
        .single()
        .execute()
    )
    product = product_res.data
    if not product:
        return error("Product was not found.", 404, "not_found")
    return ok({"product": product})


@admin_bp.post("/products/<product_id>/approve")
@require_admin
def approve_product(product_id):
    now = datetime.now(timezone.utc).isoformat()
    db = get_supabase()
    updated = (
        db.table("products")
        .update({"approval_status": "approved", "approved_at": now, "rejection_reason": ""})
        .eq("id", product_id)
        .execute()
    )
    db.table("seller_product_reviews").update(
        {"status": "approved", "reviewed_by": current_profile()["id"], "reviewed_at": now}
    ).eq("product_id", product_id).execute()
    _log_admin_action("product", product_id, "approve", (request.get_json(silent=True) or {}).get("notes", ""))
    product = updated.data[0] if updated.data else None
    if product:
        notify_seller_id(
            product.get("seller_id"),
            "product_approved",
            "Product approved",
            f"{product.get('name', 'Your product')} is now live in NovaMart.",
            "/seller/products",
            {"product_id": product_id},
        )
    return ok({"product": product})


@admin_bp.post("/sentra/test-review")
@require_admin
def test_review():
    """Run the Sentra review-risk engine against arbitrary input WITHOUT persisting.

    Body: { rating, body, title?, product_id?, user_id? }
    The admin can choose a real product+user, or omit them to use the admin's own
    profile and the first available product as a sandbox target. Returns the same
    analysis shape as a real submission so the UI can render flags/categories.
    """
    body = request.get_json(silent=True) or {}
    if not body.get("body") or not body.get("rating"):
        return error("Rating and review text are required.", 422, "validation_error")
    try:
        rating = int(body.get("rating"))
    except (TypeError, ValueError):
        return error("Rating must be an integer 1-5.", 422, "validation_error")
    if rating < 1 or rating > 5:
        return error("Rating must be between 1 and 5.", 422, "validation_error")

    db = get_supabase()
    admin = current_profile()
    product_id = body.get("product_id")
    user_id = body.get("user_id") or admin["id"]

    target_profile = None
    if user_id and user_id != admin["id"]:
        prof = db.table("profiles").select("*").eq("id", user_id).limit(1).execute()
        target_profile = prof.data[0] if prof.data else None
    if not target_profile:
        target_profile = admin

    if not product_id:
        first_product = db.table("products").select("id").limit(1).execute()
        if first_product.data:
            product_id = first_product.data[0]["id"]
    if not product_id:
        return error("No product available to score against.", 400, "no_product")

    profile_overrides = {
        "username": body.get("username", target_profile.get("username", "")),
        "full_name": body.get("full_name", target_profile.get("full_name", "")),
        "phone": body.get("phone", target_profile.get("phone", "")),
        "address": body.get("address", target_profile.get("address", "")),
    }
    review_profile = {**target_profile, **profile_overrides}

    draft = {
        "product_id": product_id,
        "user_id": target_profile["id"],
        "rating": rating,
        "title": body.get("title", ""),
        "body": (body.get("body") or "").strip(),
        "is_verified_purchase": False,
        "verified_purchase_override": body.get("verified_purchase_override"),
        "account_age_hours_override": body.get("account_age_hours_override"),
        "trust_score_override": body.get("trust_score_override"),
        "duplicate_text_override": body.get("duplicate_text_override"),
        "review_burst_count_override": body.get("review_burst_count_override"),
        "same_text_other_products_override": body.get("same_text_other_products_override"),
        "product_review_cluster_count_override": body.get("product_review_cluster_count_override"),
        "shared_device_accounts_override": body.get("shared_device_accounts_override"),
        "shared_ip_accounts_override": body.get("shared_ip_accounts_override"),
        "device_review_burst_count_override": body.get("device_review_burst_count_override"),
        "extreme_rating_burst_count_override": body.get("extreme_rating_burst_count_override"),
        "new_account_rating_cluster_count_override": body.get("new_account_rating_cluster_count_override"),
        "status": "pending",
        "risk_score": 0,
        "risk_label": "Pending",
    }
    analysis = analyze_review(draft, review_profile)
    return ok(
        {
            "analysis": analysis,
            "input": {
                "rating": rating,
                "title": draft["title"],
                "body": draft["body"],
                "product_id": product_id,
                "user_id": target_profile["id"],
                "username": review_profile.get("username"),
            },
        }
    )


@admin_bp.get("/sentra/sample-targets")
@require_admin
def sentra_sample_targets():
    """Return a small list of products and demo profiles for the tester UI."""
    db = get_supabase()
    products = (
        db.table("products")
        .select("id, name, average_rating, category, seller_name")
        .order("created_at", desc=True)
        .limit(12)
        .execute()
    )
    profiles = (
        db.table("profiles")
        .select("id, full_name, username, role, status, created_at, phone, address")
        .order("created_at", desc=True)
        .limit(40)
        .execute()
    )
    visible_profiles = [profile for profile in (profiles.data or []) if not _is_deleted_profile(profile)]
    return ok({"products": products.data or [], "profiles": visible_profiles[:20]})


@admin_bp.get("/analytics/overview")
@require_admin
def analytics_overview():
    """Aggregate analytics for the admin overview page.

    Returns:
      - reviews_by_day: last 14 days, count of reviews grouped by status bucket
      - risk_distribution: counts of Genuine / Suspicious / High Risk reviews
      - trust_distribution: counts of trust labels
      - top_risky_users: top 5 lowest-trust users
      - latest_actions: last 8 moderation log entries
    """
    db = get_supabase()
    from collections import Counter
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=14)).isoformat()

    reviews = (
        db.table("reviews")
        .select("id, status, risk_label, created_at")
        .gte("created_at", cutoff)
        .execute()
    )
    rev_data = reviews.data or []

    by_day = {}
    for i in range(14):
        day = (now - timedelta(days=13 - i)).date().isoformat()
        by_day[day] = {"date": day, "genuine": 0, "suspicious": 0, "high_risk": 0}
    for r in rev_data:
        try:
            d = r["created_at"][:10]
        except (KeyError, TypeError):
            continue
        if d not in by_day:
            continue
        label = (r.get("risk_label") or "").lower()
        if "high" in label:
            by_day[d]["high_risk"] += 1
        elif "suspicious" in label:
            by_day[d]["suspicious"] += 1
        else:
            by_day[d]["genuine"] += 1

    all_reviews = db.table("reviews").select("risk_label").execute().data or []
    risk_counter = Counter()
    for r in all_reviews:
        label = (r.get("risk_label") or "Unknown").strip() or "Unknown"
        risk_counter[label] += 1

    trust = db.table("user_trust_scores").select("trust_label").execute().data or []
    trust_counter = Counter((t.get("trust_label") or "Unknown") for t in trust)

    top_risky = (
        db.table("user_trust_scores")
        .select("trust_score, trust_label, profiles(username, full_name)")
        .order("trust_score")
        .limit(5)
        .execute()
        .data
        or []
    )

    actions = (
        db.table("moderation_logs")
        .select("*, profiles(username, full_name)")
        .order("created_at", desc=True)
        .limit(8)
        .execute()
        .data
        or []
    )

    return ok(
        {
            "reviews_by_day": list(by_day.values()),
            "risk_distribution": [{"label": k, "count": v} for k, v in risk_counter.items()],
            "trust_distribution": [{"label": k, "count": v} for k, v in trust_counter.items()],
            "top_risky_users": top_risky,
            "latest_actions": actions,
        }
    )


@admin_bp.post("/products/<product_id>/reject")
@require_admin
def reject_product(product_id):
    body = request.get_json(silent=True) or {}
    now = datetime.now(timezone.utc).isoformat()
    db = get_supabase()
    updated = (
        db.table("products")
        .update({"approval_status": "rejected", "rejection_reason": body.get("notes", "Needs changes."), "approved_at": None})
        .eq("id", product_id)
        .execute()
    )
    db.table("seller_product_reviews").update(
        {"status": "rejected", "reviewed_by": current_profile()["id"], "reviewed_at": now}
    ).eq("product_id", product_id).execute()
    _log_admin_action("product", product_id, "reject", body.get("notes", ""))
    product = updated.data[0] if updated.data else None
    if product:
        notify_seller_id(
            product.get("seller_id"),
            "product_rejected",
            "Product needs changes",
            body.get("notes") or f"{product.get('name', 'Your product')} needs updates before approval.",
            "/seller/products",
            {"product_id": product_id},
        )
    return ok({"product": product})
