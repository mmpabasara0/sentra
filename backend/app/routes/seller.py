import re
from uuid import uuid4
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from flask import Blueprint, g, request

from app.config.settings import Settings
from app.sentra_engine.seller_scoring import analyze_product_listing, analyze_seller_application
from app.services.activity_service import log_activity
from app.services.notification_service import notify_admins, notify_profile
from app.utils.auth import current_profile, require_auth, require_seller
from app.utils.products import resolve_product
from app.utils.responses import error, ok
from app.utils.supabase_client import get_supabase

seller_bp = Blueprint("seller", __name__)

ALLOWED_PRODUCT_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_PRODUCT_IMAGES = 6
MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024


def _slugify(value):
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return slug or "seller-store"


def _unique_product_slug(seller, product_name):
    base = _slugify(f"{seller['store_name']}-{product_name}-{seller['id'][:8]}")
    candidate = base
    db = get_supabase()
    suffix = 2
    while db.table("products").select("id").eq("slug", candidate).limit(1).execute().data:
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


def _active_application(profile_id):
    res = (
        get_supabase()
        .table("seller_applications")
        .select("*, seller_documents(*)")
        .eq("profile_id", profile_id)
        .order("submitted_at", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def _seller_for_profile(profile_id):
    res = get_supabase().table("sellers").select("*").eq("profile_id", profile_id).limit(1).execute()
    return res.data[0] if res.data else None


def _upload_document(path, file_storage):
    settings = Settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase storage is not configured.")

    target = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/seller-documents/{quote(path)}"
    req = Request(
        target,
        data=file_storage.read(),
        headers={
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": file_storage.mimetype or "application/octet-stream",
            "x-upsert": "true",
        },
        method="POST",
    )
    with urlopen(req, timeout=20) as response:
        return response.status in [200, 201]


def _public_storage_url(bucket, path):
    settings = Settings()
    return f"{settings.supabase_url.rstrip('/')}/storage/v1/object/public/{bucket}/{quote(path, safe='/')}"


def _looks_like_image(content_type, data):
    if content_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/webp":
        return data.startswith(b"RIFF") and data[8:12] == b"WEBP"
    if content_type == "image/gif":
        return data.startswith((b"GIF87a", b"GIF89a"))
    return False


def _upload_product_image(path, file_storage):
    settings = Settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase storage is not configured.")

    content_type = file_storage.mimetype or "application/octet-stream"
    if content_type not in ALLOWED_PRODUCT_IMAGE_TYPES:
        raise ValueError("Only JPG, PNG, WebP, or GIF product images are allowed.")

    data = file_storage.read()
    if not data:
        raise ValueError("Product image file is empty.")
    if len(data) > MAX_PRODUCT_IMAGE_BYTES:
        raise ValueError("Each product image must be 5MB or smaller.")
    if not _looks_like_image(content_type, data):
        raise ValueError("Product image file does not match its image type.")

    target = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/product-images/{quote(path, safe='/')}"
    req = Request(
        target,
        data=data,
        headers={
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        method="POST",
    )
    with urlopen(req, timeout=20) as response:
        if response.status not in [200, 201]:
            raise RuntimeError("Storage upload failed.")
    return _public_storage_url("product-images", path)


def _product_images_from_request(seller_id, product_id=None):
    files = request.files.getlist("images")
    if len(files) > MAX_PRODUCT_IMAGES:
        raise ValueError(f"Upload up to {MAX_PRODUCT_IMAGES} product images.")

    uploaded = []
    scope = product_id or str(uuid4())
    for index, file_storage in enumerate(files):
        if not file_storage or not file_storage.filename:
            continue
        content_type = file_storage.mimetype or ""
        ext = ALLOWED_PRODUCT_IMAGE_TYPES.get(content_type, ".jpg")
        safe_name = re.sub(r"[^a-zA-Z0-9_.-]+", "-", file_storage.filename or f"product-{index}{ext}")
        path = f"{seller_id}/{scope}/{index + 1}-{uuid4().hex[:10]}-{safe_name}"
        uploaded.append(_upload_product_image(path, file_storage))
    return uploaded


def _body_value(body, key, default=None):
    if hasattr(body, "get"):
        value = body.get(key)
        return default if value is None else value
    return default


@seller_bp.get("/application")
@require_auth
def get_application():
    profile = current_profile()
    seller = _seller_for_profile(profile["id"])
    return ok({"application": _active_application(profile["id"]), "seller": seller})


@seller_bp.post("/apply")
@require_auth
def apply():
    profile = current_profile()
    body = request.get_json(silent=True) or {}
    required = ["business_or_personal_name", "email", "phone", "store_name", "address", "bank_name", "account_holder", "account_number"]
    if any(not (body.get(field) or "").strip() for field in required):
        return error("Business or personal name, email, phone, store name, address, and bank details are required.", 422, "validation_error")

    payload = {
        "profile_id": profile["id"],
        "application_type": body.get("application_type", "personal"),
        "business_or_personal_name": body["business_or_personal_name"].strip(),
        "email": body["email"].strip().lower(),
        "phone": body["phone"].strip(),
        "store_name": body["store_name"].strip(),
        "address": body["address"].strip(),
        "bank_name": (body.get("bank_name") or "").strip(),
        "account_holder": (body.get("account_holder") or "").strip(),
        "account_number": (body.get("account_number") or "").strip(),
        "account_number_last4": ((body.get("account_number") or body.get("account_number_last4") or "").strip())[-4:],
        "payment_notes": (body.get("payment_notes") or "").strip(),
        "status": "pending",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }

    analysis = analyze_seller_application(payload, profile, [])
    payload.update(
        {
            "risk_score": analysis["risk_score"],
            "risk_label": analysis["risk_label"],
            "risk_reasons": analysis["reasons"],
        }
    )

    db = get_supabase()
    existing = _active_application(profile["id"])
    is_resubmission = bool(existing and existing.get("status") in ["changes_requested", "rejected"])
    if existing and existing.get("status") in ["pending", "changes_requested", "rejected"]:
        updated = db.table("seller_applications").update(payload).eq("id", existing["id"]).execute()
        application = updated.data[0]
    else:
        created = db.table("seller_applications").insert(payload).execute()
        application = created.data[0]

    log_activity(profile["id"], "seller_application_submitted", "seller_application", application["id"], analysis)
    notify_admins(
        "seller_application_submitted",
        "Seller application resubmitted" if is_resubmission else "New seller application",
        f"{application['store_name']} is ready for admin verification.",
        f"/admin/sellers/{application['id']}",
        {"application_id": application["id"], "profile_id": profile["id"], "risk_score": analysis["risk_score"]},
    )
    return ok({"application": application, "analysis": analysis}, 201)


@seller_bp.post("/documents")
@require_auth
def upload_document():
    profile = current_profile()
    application = _active_application(profile["id"])
    if not application:
        return error("Submit the seller application before uploading documents.", 422, "application_required")

    document_type = request.form.get("document_type", "")
    if document_type not in ["nic", "utility_bill", "business_registration"]:
        return error("Document type is invalid.", 422, "validation_error")
    uploaded_file = request.files.get("file")
    if not uploaded_file:
        return error("Document file is required.", 422, "validation_error")

    safe_name = re.sub(r"[^a-zA-Z0-9_.-]+", "-", uploaded_file.filename or "document")
    file_path = f"{profile['id']}/{application['id']}/{document_type}-{safe_name}"
    try:
        _upload_document(file_path, uploaded_file)
    except (HTTPError, URLError, TimeoutError, RuntimeError):
        return error("Could not upload seller document.", 502, "storage_upload_failed")

    created = (
        get_supabase()
        .table("seller_documents")
        .insert(
            {
                "application_id": application["id"],
                "document_type": document_type,
                "file_path": file_path,
                "original_name": uploaded_file.filename or safe_name,
            }
        )
        .execute()
    )

    application = _active_application(profile["id"])
    analysis = analyze_seller_application(application, profile, application.get("seller_documents") or [])
    get_supabase().table("seller_applications").update(
        {"risk_score": analysis["risk_score"], "risk_label": analysis["risk_label"], "risk_reasons": analysis["reasons"]}
    ).eq("id", application["id"]).execute()
    notify_admins(
        "seller_document_uploaded",
        "Seller document uploaded",
        f"{application['store_name']} uploaded {document_type.replace('_', ' ')}.",
        f"/admin/sellers/{application['id']}",
        {"application_id": application["id"], "document_type": document_type, "document_id": created.data[0]["id"]},
    )
    return ok({"document": created.data[0], "analysis": analysis}, 201)


@seller_bp.get("/me")
@require_auth
def me():
    profile = current_profile()
    return ok({"seller": _seller_for_profile(profile["id"]), "application": _active_application(profile["id"])})


@seller_bp.get("/dashboard")
@require_seller
def dashboard():
    seller = g.current_seller
    db = get_supabase()
    products = db.table("products").select("id, name, approval_status, stock, product_risk_score").eq("seller_id", seller["id"]).execute()
    product_ids = [item["id"] for item in products.data or []]
    reviews = []
    order_items = []
    if product_ids:
        reviews = db.table("reviews").select("id, title, body, status, risk_score, risk_label, product_id").in_("product_id", product_ids).execute().data or []
        order_items = (
            db.table("order_items")
            .select("*, orders(id, status, created_at), products(name, image_url)")
            .in_("product_id", product_ids)
            .execute()
            .data
            or []
        )
    revenue = sum(float(item["unit_price"]) * int(item["quantity"]) for item in order_items)

    # Revenue by day: aggregate last 7 days for the analytics chart.
    from collections import defaultdict
    from datetime import date, timedelta
    daily = defaultdict(float)
    today = date.today()
    for item in order_items:
        created_raw = (item.get("orders") or {}).get("created_at") or ""
        if created_raw:
            try:
                order_date = datetime.fromisoformat(created_raw.replace("Z", "+00:00")).date()
                delta = (today - order_date).days
                if 0 <= delta <= 6:
                    daily[order_date.isoformat()] += float(item["unit_price"]) * int(item["quantity"])
            except (ValueError, AttributeError):
                pass
    revenue_by_day = [
        {"date": (today - timedelta(days=i)).isoformat(), "revenue": round(daily.get((today - timedelta(days=i)).isoformat(), 0), 2)}
        for i in range(6, -1, -1)
    ]

    # Product status counts for donut chart.
    product_status_counts = {"approved": 0, "pending_review": 0, "rejected": 0, "archived": 0}
    for p in products.data or []:
        status = p.get("approval_status") or "pending_review"
        if status in product_status_counts:
            product_status_counts[status] += 1

    # Review risk counts for donut chart.
    review_risk_counts = {"Genuine": 0, "Suspicious": 0, "High Risk": 0}
    for r in reviews:
        label = r.get("risk_label") or "Genuine"
        if label in review_risk_counts:
            review_risk_counts[label] += 1
        elif int(r.get("risk_score") or 0) >= 60:
            review_risk_counts["High Risk"] += 1
        elif int(r.get("risk_score") or 0) >= 30:
            review_risk_counts["Suspicious"] += 1
        else:
            review_risk_counts["Genuine"] += 1

    return ok(
        {
            "seller": seller,
            "cards": {
                "products": len(products.data or []),
                "pending_products": len([p for p in products.data or [] if p.get("approval_status") == "pending_review"]),
                "orders": len(order_items),
                "revenue": revenue,
                "flagged_reviews": len([r for r in reviews if r.get("status") in ["flagged", "quarantined"]]),
                "sentra_alerts": len([p for p in products.data or [] if int(p.get("product_risk_score") or 0) >= 30]),
            },
            "recent_orders": order_items[:8],
            "recent_reviews": sorted(reviews, key=lambda row: row.get("risk_score") or 0, reverse=True)[:8],
            "products": products.data or [],
            "revenue_by_day": revenue_by_day,
            "product_status_counts": product_status_counts,
            "review_risk_counts": review_risk_counts,
        }
    )


@seller_bp.get("/products")
@require_seller
def products():
    res = (
        get_supabase()
        .table("products")
        .select("*, seller_product_reviews(*)")
        .eq("seller_id", g.current_seller["id"])
        .neq("approval_status", "archived")
        .order("created_at", desc=True)
        .execute()
    )
    return ok({"products": res.data or []})


@seller_bp.post("/products")
@require_seller
def create_product():
    is_form = request.content_type and request.content_type.startswith("multipart/form-data")
    body = request.form if is_form else (request.get_json(silent=True) or {})
    required = ["name", "description", "price", "stock", "category"]
    if any(_body_value(body, field) in [None, ""] for field in required):
        return error("Name, description, price, stock, and category are required.", 422, "validation_error")

    seller = g.current_seller
    try:
        uploaded_images = _product_images_from_request(seller["id"]) if is_form else []
    except (HTTPError, URLError, TimeoutError, RuntimeError):
        return error("Could not upload product images.", 502, "storage_upload_failed")
    except ValueError as exc:
        return error(str(exc), 422, "validation_error")

    image_url = uploaded_images[0] if uploaded_images else (_body_value(body, "image_url") or "/products/home-market-hero.svg")
    product_name = _body_value(body, "name", "").strip()
    draft = {
        "name": product_name,
        "slug": _unique_product_slug(seller, product_name),
        "description": _body_value(body, "description", "").strip(),
        "price": float(_body_value(body, "price")),
        "stock": int(_body_value(body, "stock")),
        "category": _body_value(body, "category", "").strip(),
        "seller_name": seller["store_name"],
        "seller_id": seller["id"],
        "image_url": image_url,
        "product_images": uploaded_images or [image_url],
        "average_rating": 0,
        "approval_status": "pending_review",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    analysis = analyze_product_listing(draft, seller)
    draft.update(
        {
            "product_risk_score": analysis["risk_score"],
            "product_risk_label": analysis["risk_label"],
            "product_risk_reasons": analysis["reasons"],
        }
    )
    created = get_supabase().table("products").insert(draft).execute()
    product = created.data[0]
    get_supabase().table("seller_product_reviews").insert(
        {
            "product_id": product["id"],
            "seller_id": seller["id"],
            "status": "pending_review",
            "risk_score": analysis["risk_score"],
            "risk_label": analysis["risk_label"],
            "reasons_json": analysis["reasons"],
        }
    ).execute()
    log_activity(current_profile()["id"], "seller_product_submitted", "product", product["id"], analysis)
    notify_admins(
        "seller_product_submitted",
        "Product pending approval",
        f"{seller['store_name']} submitted {product['name']} for product review.",
        "/admin/products",
        {"product_id": product["id"], "seller_id": seller["id"], "risk_score": analysis["risk_score"]},
    )
    return ok({"product": product, "analysis": analysis}, 201)


@seller_bp.put("/products/<product_id>")
@require_seller
def update_product(product_id):
    product = resolve_product(product_id)
    if not product or product.get("seller_id") != g.current_seller["id"]:
        return error("Product was not found.", 404, "not_found")
    is_form = request.content_type and request.content_type.startswith("multipart/form-data")
    body = request.form if is_form else (request.get_json(silent=True) or {})
    payload = {field: _body_value(body, field) for field in ["name", "description", "price", "stock", "category", "image_url"] if _body_value(body, field) is not None}
    if "name" in payload:
        payload["name"] = payload["name"].strip()
    if "description" in payload:
        payload["description"] = payload["description"].strip()
    if "price" in payload:
        payload["price"] = float(payload["price"])
    if "stock" in payload:
        payload["stock"] = int(payload["stock"])
    if is_form:
        try:
            uploaded_images = _product_images_from_request(g.current_seller["id"], product["id"])
        except (HTTPError, URLError, TimeoutError, RuntimeError):
            return error("Could not upload product images.", 502, "storage_upload_failed")
        except ValueError as exc:
            return error(str(exc), 422, "validation_error")
        if uploaded_images:
            payload["image_url"] = uploaded_images[0]
            payload["product_images"] = uploaded_images
    payload["approval_status"] = "pending_review"
    payload["submitted_at"] = datetime.now(timezone.utc).isoformat()
    payload["rejection_reason"] = ""
    next_product = {**product, **payload}
    analysis = analyze_product_listing(next_product, g.current_seller)
    payload.update(
        {
            "product_risk_score": analysis["risk_score"],
            "product_risk_label": analysis["risk_label"],
            "product_risk_reasons": analysis["reasons"],
        }
    )
    updated = get_supabase().table("products").update(payload).eq("id", product["id"]).execute()
    next_product_row = updated.data[0] if updated.data else None
    if next_product_row:
        notify_admins(
            "seller_product_submitted",
            "Product resubmitted",
            f"{g.current_seller['store_name']} resubmitted {next_product_row['name']} for review.",
            "/admin/products",
            {"product_id": next_product_row["id"], "seller_id": g.current_seller["id"], "risk_score": analysis["risk_score"]},
        )
    return ok({"product": next_product_row, "analysis": analysis})


@seller_bp.delete("/products/<product_id>")
@require_seller
def delete_product(product_id):
    product = resolve_product(product_id)
    if not product or product.get("seller_id") != g.current_seller["id"]:
        return error("Product was not found.", 404, "not_found")
    updated = get_supabase().table("products").update({"approval_status": "archived"}).eq("id", product["id"]).execute()
    return ok({"product": updated.data[0] if updated.data else None})


@seller_bp.get("/orders")
@require_seller
def orders():
    product_rows = get_supabase().table("products").select("id").eq("seller_id", g.current_seller["id"]).execute()
    product_ids = [row["id"] for row in product_rows.data or []]
    if not product_ids:
        return ok({"orders": []})
    rows = (
        get_supabase()
        .table("order_items")
        .select("*, orders(id, user_id, status, fulfilment_status, created_at, total_amount), products(name, image_url)")
        .in_("product_id", product_ids)
        .execute()
    )
    return ok({"orders": rows.data or []})


@seller_bp.put("/orders/<order_id>/status")
@require_seller
def update_order_status(order_id):
    body = request.get_json(silent=True) or {}
    new_status = (body.get("fulfilment_status") or "").strip()
    allowed = ["packed", "shipped", "delivered"]
    if new_status not in allowed:
        return error(f"fulfilment_status must be one of: {', '.join(allowed)}.", 422, "validation_error")

    db = get_supabase()
    # Verify this order contains a product belonging to this seller.
    seller = g.current_seller
    product_rows = db.table("products").select("id").eq("seller_id", seller["id"]).execute()
    product_ids = [row["id"] for row in product_rows.data or []]
    if not product_ids:
        return error("No products found for this seller.", 404, "not_found")

    items = db.table("order_items").select("order_id").in_("product_id", product_ids).eq("order_id", order_id).execute()
    if not items.data:
        return error("Order was not found for your seller account.", 404, "not_found")

    updated = db.table("orders").update({"fulfilment_status": new_status}).eq("id", order_id).execute()
    order = updated.data[0] if updated.data else None
    if order:
        notify_profile(
            order["user_id"],
            "customer",
            "order_update",
            "Order status updated",
            f"Your order is now {new_status}.",
            f"/orders/{order_id}",
            {"order_id": order_id, "fulfilment_status": new_status},
        )
    return ok({"order": order})


@seller_bp.get("/reviews")
@require_seller
def reviews():
    product_rows = get_supabase().table("products").select("id").eq("seller_id", g.current_seller["id"]).execute()
    product_ids = [row["id"] for row in product_rows.data or []]
    if not product_ids:
        return ok({"reviews": []})
    rows = (
        get_supabase()
        .table("reviews")
        .select("*, products(name), profiles(username, full_name)")
        .in_("product_id", product_ids)
        .order("risk_score", desc=True)
        .execute()
    )
    return ok({"reviews": rows.data or []})


@seller_bp.get("/sentra-alerts")
@require_seller
def sentra_alerts():
    products = (
        get_supabase()
        .table("products")
        .select("id, name, approval_status, product_risk_score, product_risk_label, product_risk_reasons")
        .eq("seller_id", g.current_seller["id"])
        .gte("product_risk_score", 30)
        .order("product_risk_score", desc=True)
        .execute()
    )
    return ok({"alerts": products.data or []})
