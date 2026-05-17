from flask import Blueprint, request, jsonify, send_file, g
from app.routes.auth import require_auth
from app.services.pdf_parser import parse_deel_invoice
from app.services.invoice_generator import render_invoice_pdf
from app.models.invoice import Invoice
from app import db
import io
import json
import logging
import time

logger = logging.getLogger(__name__)

invoice_bp = Blueprint("invoice", __name__)

# ── Per-user in-memory cache for read-heavy endpoints ─────────────────────────
_cache: dict[int, dict] = {}      # user_id -> {key: value, _ts_key: timestamp}
_CACHE_TTL = 30                    # seconds

def _cache_get(user_id: int, key: str):
    entry = _cache.get(user_id, {})
    if time.time() - entry.get(f"_ts_{key}", 0) < _CACHE_TTL:
        return entry.get(key)
    return None

def _cache_set(user_id: int, key: str, value):
    _cache.setdefault(user_id, {})[key] = value
    _cache[user_id][f"_ts_{key}"] = time.time()

def _cache_invalidate(user_id: int):
    _cache.pop(user_id, None)


def _save_invoice(user_id: int, parsed_data: dict, invoice_number: str) -> Invoice:
    # Upsert: if same invoice_number already exists for this user, update it
    inv = Invoice.query.filter_by(user_id=user_id, invoice_number=invoice_number).first()
    if inv:
        inv.client_name = parsed_data.get("bill_to_name", "")
        inv.amount = parsed_data.get("total", 0)
        inv.currency = parsed_data.get("currency", "USD")
        inv.issue_date = parsed_data.get("issue_date")
        inv.due_date = parsed_data.get("due_date")
        inv.deel_ref = parsed_data.get("deel_ref")
        inv.parsed_data = json.dumps(parsed_data)
    else:
        inv = Invoice(
            user_id=user_id,
            invoice_number=invoice_number,
            client_name=parsed_data.get("bill_to_name", ""),
            amount=parsed_data.get("total", 0),
            currency=parsed_data.get("currency", "USD"),
            issue_date=parsed_data.get("issue_date"),
            due_date=parsed_data.get("due_date"),
            deel_ref=parsed_data.get("deel_ref"),
            status="unpaid",
            parsed_data=json.dumps(parsed_data),
        )
        db.session.add(inv)
    db.session.commit()
    return inv


# ── Parse ──────────────────────────────────────────────────────────────────────

@invoice_bp.route("/parse", methods=["POST"])
@require_auth
def parse_invoice():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are accepted"}), 400
    pdf_bytes = file.read()
    logger.info("Parsing invoice: %s (%d bytes)", file.filename, len(pdf_bytes))
    try:
        parsed = parse_deel_invoice(pdf_bytes)
        return jsonify({"success": True, "data": parsed})
    except Exception as e:
        logger.exception("Failed to parse invoice")
        return jsonify({"error": f"Failed to parse invoice: {str(e)}"}), 500


# ── Generate ───────────────────────────────────────────────────────────────────

@invoice_bp.route("/generate", methods=["POST"])
@require_auth
def generate_invoice():
    parsed_data = request.get_json()
    if not parsed_data:
        return jsonify({"error": "No invoice data provided"}), 400
    try:
        pdf_bytes, invoice_number = render_invoice_pdf(parsed_data, g.user_id)
        _save_invoice(g.user_id, parsed_data, invoice_number)
        _cache_invalidate(g.user_id)
        logger.info("Invoice generated and saved: %s", invoice_number)
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"{invoice_number}.pdf",
        )
    except Exception as e:
        logger.exception("Failed to generate invoice")
        return jsonify({"error": f"Failed to generate invoice: {str(e)}"}), 500


# ── Re-download saved invoice ──────────────────────────────────────────────────

@invoice_bp.route("/<int:invoice_id>/pdf", methods=["GET"])
@require_auth
def download_invoice(invoice_id):
    inv = Invoice.query.filter_by(id=invoice_id, user_id=g.user_id).first()
    if not inv:
        return jsonify({"error": "Invoice not found"}), 404
    if not inv.parsed_data:
        return jsonify({"error": "PDF data not available for this invoice"}), 404
    try:
        parsed = json.loads(inv.parsed_data)
        pdf_bytes, _ = render_invoice_pdf(parsed, g.user_id)
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"{inv.invoice_number}.pdf",
        )
    except Exception as e:
        logger.exception("Failed to regenerate invoice PDF")
        return jsonify({"error": str(e)}), 500


# ── History & stats ────────────────────────────────────────────────────────────

@invoice_bp.route("/history", methods=["GET"])
@require_auth
def invoice_history():
    cached = _cache_get(g.user_id, "history")
    if cached is not None:
        return jsonify(cached)
    invoices = (
        Invoice.query
        .filter_by(user_id=g.user_id)
        .order_by(Invoice.created_at.desc())
        .all()
    )
    result = [inv.to_dict() for inv in invoices]
    _cache_set(g.user_id, "history", result)
    return jsonify(result)


@invoice_bp.route("/stats", methods=["GET"])
@require_auth
def invoice_stats():
    cached = _cache_get(g.user_id, "stats")
    if cached is not None:
        return jsonify(cached)
    invoices = Invoice.query.filter_by(user_id=g.user_id).all()
    total = sum(i.amount for i in invoices)
    paid = sum(i.amount for i in invoices if i.status == "paid")
    monthly: dict[str, float] = {}
    for inv in invoices:
        if inv.issue_date and len(inv.issue_date) >= 7:
            k = inv.issue_date[:7]
            monthly[k] = monthly.get(k, 0) + inv.amount
    result = {
        "total": total,
        "paid": paid,
        "unpaid": total - paid,
        "count": len(invoices),
        "monthly": [{"month": k, "amount": v} for k, v in sorted(monthly.items())],
    }
    _cache_set(g.user_id, "stats", result)
    return jsonify(result)


# ── Single update / delete ─────────────────────────────────────────────────────

@invoice_bp.route("/<int:invoice_id>/status", methods=["PATCH"])
@require_auth
def update_status(invoice_id):
    inv = Invoice.query.filter_by(id=invoice_id, user_id=g.user_id).first()
    if not inv:
        return jsonify({"error": "Invoice not found"}), 404
    status = (request.get_json() or {}).get("status")
    if status not in ("paid", "unpaid"):
        return jsonify({"error": "status must be 'paid' or 'unpaid'"}), 400
    inv.status = status
    db.session.commit()
    _cache_invalidate(g.user_id)
    return jsonify(inv.to_dict())


@invoice_bp.route("/<int:invoice_id>", methods=["DELETE"])
@require_auth
def delete_invoice(invoice_id):
    inv = Invoice.query.filter_by(id=invoice_id, user_id=g.user_id).first()
    if not inv:
        return jsonify({"error": "Invoice not found"}), 404
    db.session.delete(inv)
    db.session.commit()
    _cache_invalidate(g.user_id)
    return jsonify({"success": True})


# ── Bulk actions ───────────────────────────────────────────────────────────────

@invoice_bp.route("/bulk-status", methods=["PATCH"])
@require_auth
def bulk_status():
    data = request.get_json() or {}
    ids = data.get("ids", [])
    status = data.get("status")
    if status not in ("paid", "unpaid"):
        return jsonify({"error": "status must be 'paid' or 'unpaid'"}), 400
    Invoice.query.filter(
        Invoice.id.in_(ids), Invoice.user_id == g.user_id
    ).update({"status": status}, synchronize_session=False)
    db.session.commit()
    _cache_invalidate(g.user_id)
    return jsonify({"success": True, "updated": len(ids)})


@invoice_bp.route("/bulk-delete", methods=["POST"])
@require_auth
def bulk_delete():
    ids = (request.get_json() or {}).get("ids", [])
    deleted = Invoice.query.filter(
        Invoice.id.in_(ids), Invoice.user_id == g.user_id
    ).delete(synchronize_session=False)
    db.session.commit()
    _cache_invalidate(g.user_id)
    return jsonify({"success": True, "deleted": deleted})
