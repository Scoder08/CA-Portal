from flask import Blueprint, request, jsonify
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
    settings = Settings.get_all_as_dict()
    # Mask base64 blobs in response for size — send a flag instead
    safe = {}
    for k, v in settings.items():
        if k in ("logo_base64", "signature_base64"):
            safe[k] = v  # keep full base64 for preview
        else:
            safe[k] = v
    return jsonify(safe)


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
        Settings.set(key, value)
        updated.append(key)

    return jsonify({"success": True, "updated": updated})


@admin_bp.route("/settings/upload-image", methods=["POST"])
@require_auth
def upload_image():
    """Upload logo or signature image, stores as base64."""
    image_type = request.form.get("type")  # "logo" or "signature"
    if image_type not in ("logo", "signature"):
        return jsonify({"error": "type must be 'logo' or 'signature'"}), 400

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    file_bytes = file.read()
    b64 = base64.b64encode(file_bytes).decode("utf-8")

    key = f"{image_type}_base64"
    Settings.set(key, b64)

    return jsonify({"success": True, "key": key, "size_bytes": len(file_bytes)})


@admin_bp.route("/settings/reset", methods=["POST"])
@require_auth
def reset_settings():
    """Reset all settings to defaults."""
    db.session.query(Settings).delete()
    db.session.commit()
    Settings.seed_defaults()
    return jsonify({"success": True, "message": "Settings reset to defaults"})
