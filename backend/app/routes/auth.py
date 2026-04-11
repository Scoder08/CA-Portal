from flask import Blueprint, request, jsonify
import os
import jwt
import datetime

auth_bp = Blueprint("auth", __name__)

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-prod")
PORTAL_PASSWORD = os.getenv("PORTAL_PASSWORD", "ca-portal-2026")


def verify_token(token: str) -> bool:
    try:
        jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return True
    except Exception:
        return False


def require_auth(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token or not verify_token(token):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    password = data.get("password", "")

    if password != PORTAL_PASSWORD:
        return jsonify({"error": "Invalid password"}), 401

    token = jwt.encode(
        {
            "sub": "ca-portal-user",
            "iat": datetime.datetime.utcnow(),
            "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30),
        },
        SECRET_KEY,
        algorithm="HS256",
    )

    return jsonify({"token": token, "message": "Login successful"})


@auth_bp.route("/verify", methods=["GET"])
def verify():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token and verify_token(token):
        return jsonify({"valid": True})
    return jsonify({"valid": False}), 401
