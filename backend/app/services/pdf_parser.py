import openai
import json
import re
import fitz  # PyMuPDF


def _extract_text(pdf_bytes: bytes) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    return "\n".join(page.get_text() for page in doc)


def parse_deel_invoice(pdf_bytes: bytes) -> dict:
    """
    Extract text from PDF with PyMuPDF, then parse with gpt-4o-mini.
    """
    client = openai.OpenAI()

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

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.choices[0].message.content.strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    return json.loads(raw)
