from flask import jsonify


def ok(data=None, status=200):
    return jsonify(data or {}), status


def error(message, status=400, code="bad_request"):
    return jsonify({"error": {"code": code, "message": message}}), status
