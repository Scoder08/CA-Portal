from weasyprint import HTML
from jinja2 import Environment, FileSystemLoader
from app.models.settings import Settings
import os
import re
from datetime import datetime


TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates", "invoice")

# Cached at module level — template file is only read once per process lifetime
_jinja_env: Environment | None = None
_invoice_template = None

def _get_template():
    global _jinja_env, _invoice_template
    if _invoice_template is None:
        _jinja_env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))
        _invoice_template = _jinja_env.get_template("template.html")
    return _invoice_template


def _format_date(date_str: str) -> str:
    """Convert YYYY-MM-DD to DD MMM YYYY for display."""
    if not date_str:
        return ""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").strftime("%d %b %Y")
    except Exception:
        return date_str


def generate_invoice_number(original_ref: str, prefix: str = "INV") -> str:
    """
    Generate invoice number from Deel ref or date.
    E.g. INV-2026-1
    """
    year = datetime.now().year
    # Try to extract a number from the original ref
    nums = re.findall(r"\d+", original_ref or "")
    seq = nums[-1] if nums else "1"
    return f"{prefix}-{year}-{seq}"


def render_invoice_pdf(parsed_data: dict, user_id: int) -> bytes:
    """
    Take parsed invoice data + settings, render HTML template, return PDF bytes.
    """
    settings = Settings.get_all_as_dict(user_id)

    invoice_prefix = settings.get("invoice_prefix", "INV")
    invoice_number = generate_invoice_number(
        parsed_data.get("invoice_number", ""),
        invoice_prefix,
    )

    # Attach period to each line item if available
    line_items = parsed_data.get("line_items", [])
    for item in line_items:
        item["period_start"] = _format_date(parsed_data.get("period_start")) or ""
        item["period_end"] = _format_date(parsed_data.get("period_end")) or ""

    context = {
        # Seller (from settings)
        "seller_name": settings.get("seller_name", ""),
        "seller_address": settings.get("seller_address", ""),
        "seller_city": settings.get("seller_city", ""),
        "seller_country": settings.get("seller_country", ""),
        "seller_phone": settings.get("seller_phone", ""),
        "seller_email": settings.get("seller_email", ""),
        "seller_gstin": settings.get("seller_gstin", ""),
        "seller_pan": settings.get("seller_pan", ""),
        "logo_base64": settings.get("logo_base64", ""),
        "signature_base64": settings.get("signature_base64", ""),
        # Bank details
        "bank_name": settings.get("bank_name", ""),
        "bank_account_number": settings.get("bank_account_number", ""),
        "bank_ifsc": settings.get("bank_ifsc", ""),
        "bank_swift": settings.get("bank_swift", ""),
        "invoice_notes": settings.get("invoice_notes", ""),
        # Invoice meta (from parsed Deel data)
        "invoice_number": invoice_number,
        "issue_date": _format_date(parsed_data.get("issue_date", "")),
        "due_date": _format_date(parsed_data.get("due_date", "")),
        # Bill To
        "bill_to_name": parsed_data.get("bill_to_name", ""),
        "bill_to_address": parsed_data.get("bill_to_address", ""),
        "bill_to_city": parsed_data.get("bill_to_city", ""),
        "bill_to_country": parsed_data.get("bill_to_country", ""),
        "bill_to_vat_id": parsed_data.get("bill_to_vat_id", ""),
        "bill_to_group": parsed_data.get("bill_to_group", ""),
        # Line items & totals
        "line_items": line_items,
        "subtotal": parsed_data.get("subtotal", 0),
        "tax_rate": parsed_data.get("tax_rate", 0),
        "tax_amount": parsed_data.get("tax_amount", 0),
        "total": parsed_data.get("total", 0),
        "currency": parsed_data.get("currency", settings.get("currency", "USD")),
        "deel_ref": parsed_data.get("deel_ref", ""),
    }

    html_str = _get_template().render(**context)
    pdf_bytes = HTML(string=html_str, base_url=TEMPLATE_DIR).write_pdf()
    return pdf_bytes, invoice_number
