from flask import Blueprint

from app.services.activity_service import log_activity
from app.services.notification_service import notify_many, notify_profile
from app.utils.auth import current_profile, require_auth
from app.utils.responses import error, ok
from app.utils.supabase_client import get_supabase

orders_bp = Blueprint("orders", __name__)


@orders_bp.get("")
@require_auth
def list_orders():
    user_id = current_profile()["id"]
    res = (
        get_supabase()
        .table("orders")
        .select("*, order_items(*, products(id, name, slug, description, price, stock, category, seller_name, image_url, average_rating))")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return ok({"orders": res.data or []})


@orders_bp.get("/<order_id>")
@require_auth
def get_order(order_id):
    res = (
        get_supabase()
        .table("orders")
        .select("*, order_items(*, products(*))")
        .eq("id", order_id)
        .eq("user_id", current_profile()["id"])
        .single()
        .execute()
    )
    return ok({"order": res.data})


@orders_bp.post("")
@require_auth
def place_order():
    db = get_supabase()
    user_id = current_profile()["id"]
    cart = db.table("cart_items").select("*, products(*)").eq("user_id", user_id).execute()
    items = cart.data or []
    if not items:
        return error("Add at least one product before checkout.", 422, "empty_cart")

    total = sum(float(item["products"]["price"]) * int(item["quantity"]) for item in items)
    order = db.table("orders").insert({"user_id": user_id, "total_amount": total, "status": "paid"}).execute()
    order_id = order.data[0]["id"]
    rows = [
        {
            "order_id": order_id,
            "product_id": item["product_id"],
            "quantity": item["quantity"],
            "unit_price": item["products"]["price"],
        }
        for item in items
    ]
    db.table("order_items").insert(rows).execute()
    db.table("cart_items").delete().eq("user_id", user_id).execute()
    log_activity(user_id, "order_placed", "order", order_id, {"total": total})
    notify_profile(
        user_id,
        "customer",
        "order_placed",
        "Order placed",
        f"Your NovaMart order for LKR {total:,.2f} was placed successfully.",
        f"/orders/{order_id}",
        {"order_id": order_id, "total": total},
    )
    seller_ids = sorted({item.get("products", {}).get("seller_id") for item in items if item.get("products", {}).get("seller_id")})
    if seller_ids:
        sellers = db.table("sellers").select("profile_id").in_("id", seller_ids).execute().data or []
        notify_many(
            [seller["profile_id"] for seller in sellers],
            "seller",
            "new_order",
            "New order received",
            "A customer placed an order containing one of your products.",
            "/seller/orders",
            {"order_id": order_id},
        )
    return ok({"order_id": order_id, "total_amount": total}, 201)
