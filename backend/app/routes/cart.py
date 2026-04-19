from flask import Blueprint, request

from app.utils.auth import current_profile, require_auth
from app.utils.products import resolve_product
from app.utils.responses import error, ok
from app.utils.supabase_client import get_supabase

cart_bp = Blueprint("cart", __name__)


@cart_bp.get("")
@require_auth
def get_cart():
    user_id = current_profile()["id"]
    res = (
        get_supabase()
        .table("cart_items")
        .select("*, products(*)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return ok({"items": res.data or []})


@cart_bp.post("/items")
@require_auth
def add_item():
    body = request.get_json(silent=True) or {}
    if not body.get("product_id"):
        return error("Product is required.", 422, "validation_error")
    product = resolve_product(body["product_id"])
    if not product:
        return error("Product was not found.", 404, "not_found")

    user_id = current_profile()["id"]
    quantity = max(int(body.get("quantity", 1)), 1)
    existing = (
        get_supabase()
        .table("cart_items")
        .select("*")
        .eq("user_id", user_id)
        .eq("product_id", product["id"])
        .limit(1)
        .execute()
    )

    if existing.data:
        current_item = existing.data[0]
        updated = (
            get_supabase()
            .table("cart_items")
            .update({"quantity": int(current_item["quantity"]) + quantity})
            .eq("id", current_item["id"])
            .eq("user_id", user_id)
            .execute()
        )
        return ok({"item": updated.data[0] if updated.data else current_item})

    payload = {
        "user_id": user_id,
        "product_id": product["id"],
        "quantity": quantity,
    }
    created = get_supabase().table("cart_items").insert(payload).execute()
    return ok({"item": created.data[0]}, 201)


@cart_bp.put("/items/<item_id>")
@require_auth
def update_item(item_id):
    body = request.get_json(silent=True) or {}
    quantity = max(int(body.get("quantity", 1)), 1)
    updated = (
        get_supabase()
        .table("cart_items")
        .update({"quantity": quantity})
        .eq("id", item_id)
        .eq("user_id", current_profile()["id"])
        .execute()
    )
    return ok({"item": updated.data[0] if updated.data else None})


@cart_bp.delete("/items/<item_id>")
@require_auth
def delete_item(item_id):
    get_supabase().table("cart_items").delete().eq("id", item_id).eq("user_id", current_profile()["id"]).execute()
    return ok({"deleted": True})
