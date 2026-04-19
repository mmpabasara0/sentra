from flask import Flask, jsonify
from flask_cors import CORS

from app.config.settings import Settings
from app.routes.admin import admin_bp
from app.routes.auth import auth_bp
from app.routes.cart import cart_bp
from app.routes.comments import comments_bp
from app.routes.orders import orders_bp
from app.routes.products import products_bp
from app.routes.reviews import reviews_bp
from app.routes.seller import seller_bp


def create_app() -> Flask:
    app = Flask(__name__)
    settings = Settings()
    app.config.update(
        DEBUG=settings.debug,
        MAX_CONTENT_LENGTH=8 * 1024 * 1024,
        JSON_SORT_KEYS=False,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=settings.is_production,
    )

    CORS(
        app,
        origins=[settings.app_origin],
        allow_headers=["Authorization", "Content-Type"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    @app.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "sentra-api"})

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(products_bp, url_prefix="/api/products")
    app.register_blueprint(cart_bp, url_prefix="/api/cart")
    app.register_blueprint(orders_bp, url_prefix="/api/orders")
    app.register_blueprint(reviews_bp, url_prefix="/api")
    app.register_blueprint(comments_bp, url_prefix="/api")
    app.register_blueprint(seller_bp, url_prefix="/api/seller")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")

    return app
