from flask import Blueprint, request, jsonify, send_file
from app.routes.auth import require_auth
from app.services.pdf_parser import parse_deel_invoice
from app.services.invoice_generator import render_invoice_pdf
import io
import logging

logger = logging.getLogger(__name__)

invoice_bp = Blueprint("invoice", __name__)


@invoice_bp.route("/parse", methods=["POST"])
@require_auth
def parse_invoice():
    """Parse a Deel PDF and return extracted JSON data for preview."""
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
    """Generate PDF invoice from parsed data (sent as JSON body)."""
    parsed_data = request.get_json()
    if not parsed_data:
        return jsonify({"error": "No invoice data provided"}), 400

    logger.info("Generating invoice from parsed data")
    try:
        pdf_bytes, invoice_number = render_invoice_pdf(parsed_data)
        logger.info("Invoice generated: %s", invoice_number)
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"{invoice_number}.pdf",
        )
    except Exception as e:
        logger.exception("Failed to generate invoice")
        return jsonify({"error": f"Failed to generate invoice: {str(e)}"}), 500


@invoice_bp.route("/parse-and-generate", methods=["POST"])
@require_auth
def parse_and_generate():
    """One-shot: upload Deel PDF, get your invoice PDF back."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    pdf_bytes = file.read()

    logger.info("Parse-and-generate: %s (%d bytes)", file.filename, len(pdf_bytes))
    try:
        parsed = parse_deel_invoice(pdf_bytes)
        pdf_bytes_out, invoice_number = render_invoice_pdf(parsed)
        logger.info("Invoice generated: %s", invoice_number)
        return send_file(
            io.BytesIO(pdf_bytes_out),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"{invoice_number}.pdf",
        )
    except Exception as e:
        logger.exception("Failed in parse-and-generate")
        return jsonify({"error": str(e)}), 500
