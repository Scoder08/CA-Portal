from flask import Blueprint, request, jsonify, g
from functools import wraps
import os
import jwt
import datetime
from app import db
from app.models.user import User
from app.models.settings import Settings

auth_bp = Blueprint("auth", __name__)

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-prod")


def _create_token(user_id: int) -> str:
    return jwt.encode(
        {
            "user_id": user_id,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30),
        },
        SECRET_KEY,
        algorithm="HS256",
    )


def _decode_token(token: str):
    """Returns user_id int or None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("user_id")
    except Exception:
        return None


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        user_id = _decode_token(token)
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401
        g.user_id = user_id
        return f(*args, **kwargs)
    return decorated


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    name = (data.get("name") or "").strip()

    if not email or not password or not name:
        return jsonify({"error": "name, email and password are required"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    user = User(email=email, name=name)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    Settings.seed_defaults(user.id)

    token = _create_token(user.id)
    return jsonify({"token": token, "name": user.name, "email": user.email}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = _create_token(user.id)
    return jsonify({"token": token, "name": user.name, "email": user.email})


@auth_bp.route("/verify", methods=["GET"])
def verify():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = _decode_token(token)
    if user_id:
        user = db.session.get(User, user_id)
        if user:
            return jsonify({"valid": True, "name": user.name, "email": user.email})
    return jsonify({"valid": False}), 401
