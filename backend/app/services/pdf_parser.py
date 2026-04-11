import openai
import json
import re
import hashlib
import logging
import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

# Module-level singleton — avoids re-initialising on every request
_openai_client = openai.OpenAI()

# In-memory cache: sha256(pdf_bytes) -> parsed dict
_parse_cache: dict[str, dict] = {}


def _pdf_hash(pdf_bytes: bytes) -> str:
    return hashlib.sha256(pdf_bytes).hexdigest()


def _extract_text(pdf_bytes: bytes) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    return "\n".join(page.get_text() for page in doc)


def parse_deel_invoice(pdf_bytes: bytes) -> dict:
    """
    Extract text from PDF with PyMuPDF, then parse with gpt-4o-mini.
    Results are cached by PDF content hash to avoid redundant API calls.
    """
    key = _pdf_hash(pdf_bytes)
    if key in _parse_cache:
        logger.info("parse cache hit (%s…)", key[:12])
        return _parse_cache[key]

    logger.info("parse cache miss — calling OpenAI")
    text = _extract_text(pdf_bytes)

    prompt = f"""Extract all invoice data from the following Deel invoice text and return ONLY a JSON object with these exact fields:

{{
  "invoice_number": "original invoice number from Deel",
  "issue_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "period_start": "YYYY-MM-DD or null",
  "period_end": "YYYY-MM-DD or null",
  "bill_to_name": "company name",
  "bill_to_address": "street address",
  "bill_to_city": "city, state zip",
  "bill_to_country": "country",
  "bill_to_vat_id": "VAT ID or null",
  "bill_to_group": "team/group name or null",
  "line_items": [
    {{
      "description": "service description",
      "scope_url": "google docs url or null",
      "quantity": 1,
      "rate": 2100.00,
      "amount": 2100.00,
      "contract_type": "Fixed contract or Time & Materials"
    }}
  ],
  "subtotal": 2100.00,
  "tax_rate": 0,
  "tax_amount": 0,
  "total": 2100.00,
  "currency": "USD",
  "deel_ref": "Deel reference number or null"
}}

Return ONLY the JSON, no markdown, no explanation.

Invoice text:
{text}"""

    response = _openai_client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.choices[0].message.content.strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    result = json.loads(raw)
    _parse_cache[key] = result
    return result
