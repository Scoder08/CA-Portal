from flask import Blueprint, request, jsonify, g
from app.routes.auth import require_auth
from app.models.settings import Settings
from app import db
import base64

admin_bp = Blueprint("admin", __name__)

ALLOWED_KEYS = {
    "seller_name", "seller_address", "seller_city", "seller_country",
    "seller_phone", "seller_gstin", "seller_pan", "seller_email",
    "bank_name", "bank_account_number", "bank_ifsc", "bank_swift",
    "invoice_prefix", "invoice_notes", "currency",
    "logo_base64", "signature_base64",
}


@admin_bp.route("/settings", methods=["GET"])
@require_auth
def get_settings():
    return jsonify(Settings.get_all_as_dict(g.user_id))


@admin_bp.route("/settings", methods=["PUT"])
@require_auth
def update_settings():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    updated = []
    for key, value in data.items():
        if key not in ALLOWED_KEYS:
            continue
        Settings.set(g.user_id, key, value)
        updated.append(key)

    Settings.invalidate_cache(g.user_id)
    return jsonify({"success": True, "updated": updated})


@admin_bp.route("/settings/upload-image", methods=["POST"])
@require_auth
def upload_image():
    image_type = request.form.get("type")
    if image_type not in ("logo", "signature"):
        return jsonify({"error": "type must be 'logo' or 'signature'"}), 400
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file_bytes = request.files["file"].read()
    b64 = base64.b64encode(file_bytes).decode("utf-8")

    key = f"{image_type}_base64"
    Settings.set(g.user_id, key, b64)
    Settings.invalidate_cache(g.user_id)

    return jsonify({"success": True, "key": key, "size_bytes": len(file_bytes)})


@admin_bp.route("/settings/reset", methods=["POST"])
@require_auth
def reset_settings():
    db.session.query(Settings).filter_by(user_id=g.user_id).delete()
    db.session.commit()
    Settings.seed_defaults(g.user_id)
    Settings.invalidate_cache(g.user_id)
    return jsonify({"success": True, "message": "Settings reset to defaults"})
