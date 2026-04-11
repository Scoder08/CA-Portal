from flask import Blueprint, request, jsonify, send_file, g
from app.routes.auth import require_auth
from app.services.pdf_parser import parse_deel_invoice
from app.services.invoice_generator import render_invoice_pdf
from app.models.invoice import Invoice
from app import db
import io
import logging
from sqlalchemy import extract, func

logger = logging.getLogger(__name__)

invoice_bp = Blueprint("invoice", __name__)


def _save_invoice(user_id: int, parsed_data: dict, invoice_number: str):
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
    )
    db.session.add(inv)
    db.session.commit()
    return inv


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
        logger.info("Invoice parsed successfully")
        return jsonify({"success": True, "data": parsed})
    except Exception as e:
        logger.exception("Failed to parse invoice")
        return jsonify({"error": f"Failed to parse invoice: {str(e)}"}), 500


@invoice_bp.route("/generate", methods=["POST"])
@require_auth
def generate_invoice():
    parsed_data = request.get_json()
    if not parsed_data:
        return jsonify({"error": "No invoice data provided"}), 400

    logger.info("Generating invoice from parsed data")
    try:
        pdf_bytes, invoice_number = render_invoice_pdf(parsed_data, g.user_id)
        _save_invoice(g.user_id, parsed_data, invoice_number)
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


@invoice_bp.route("/history", methods=["GET"])
@require_auth
def invoice_history():
    invoices = (
        Invoice.query
        .filter_by(user_id=g.user_id)
        .order_by(Invoice.created_at.desc())
        .all()
    )
    return jsonify([inv.to_dict() for inv in invoices])


@invoice_bp.route("/stats", methods=["GET"])
@require_auth
def invoice_stats():
    invoices = Invoice.query.filter_by(user_id=g.user_id).all()

    total = sum(inv.amount for inv in invoices)
    paid = sum(inv.amount for inv in invoices if inv.status == "paid")
    unpaid = sum(inv.amount for inv in invoices if inv.status == "unpaid")

    # Monthly breakdown — group by YYYY-MM
    monthly: dict[str, float] = {}
    for inv in invoices:
        if inv.issue_date and len(inv.issue_date) >= 7:
            key = inv.issue_date[:7]  # YYYY-MM
            monthly[key] = monthly.get(key, 0) + inv.amount
    monthly_list = [{"month": k, "amount": v} for k, v in sorted(monthly.items())]

    return jsonify({
        "total": total,
        "paid": paid,
        "unpaid": unpaid,
        "count": len(invoices),
        "monthly": monthly_list,
    })


@invoice_bp.route("/<int:invoice_id>/status", methods=["PATCH"])
@require_auth
def update_status(invoice_id):
    inv = Invoice.query.filter_by(id=invoice_id, user_id=g.user_id).first()
    if not inv:
        return jsonify({"error": "Invoice not found"}), 404
    data = request.get_json() or {}
    status = data.get("status")
    if status not in ("paid", "unpaid"):
        return jsonify({"error": "status must be 'paid' or 'unpaid'"}), 400
    inv.status = status
    db.session.commit()
    return jsonify(inv.to_dict())
