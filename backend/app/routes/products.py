from flask import Blueprint, request

from app.utils.auth import require_admin
from app.utils.products import resolve_product
from app.utils.responses import error, ok
from app.utils.supabase_client import get_supabase

products_bp = Blueprint("products", __name__)


@products_bp.get("")
def list_products():
    res = get_supabase().table("products").select("*").eq("approval_status", "approved").order("created_at", desc=True).execute()
    return ok({"products": res.data or []})


@products_bp.get("/<product_id>")
def product_detail(product_id):
    product = resolve_product(product_id)
    if not product or product.get("approval_status") != "approved":
        return error("Product was not found.", 404, "not_found")

    reviews = (
        get_supabase()
        .table("reviews")
        .select("*, profiles(full_name, username), review_flags(*)")
        .eq("product_id", product["id"])
        .in_("status", ["published", "approved"])
        .order("created_at", desc=True)
        .execute()
    )
    return ok({"product": product, "reviews": reviews.data or []})


@products_bp.post("")
@require_admin
def create_product():
    body = request.get_json(silent=True) or {}
    required = ["name", "price", "stock", "category"]
    if any(body.get(field) in [None, ""] for field in required):
        return error("Name, price, stock, and category are required.", 422, "validation_error")
    created = get_supabase().table("products").insert(body).execute()
    return ok({"product": created.data[0]}, 201)


@products_bp.put("/<product_id>")
@require_admin
def update_product(product_id):
    body = request.get_json(silent=True) or {}
    updated = get_supabase().table("products").update(body).eq("id", product_id).execute()
    return ok({"product": updated.data[0] if updated.data else None})


@products_bp.delete("/<product_id>")
@require_admin
def delete_product(product_id):
    get_supabase().table("products").delete().eq("id", product_id).execute()
    return ok({"deleted": True})
