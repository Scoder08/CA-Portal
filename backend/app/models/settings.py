from app import db
import json


class Settings(db.Model):
    __tablename__ = "settings"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=True)

    @classmethod
    def get(cls, key, default=None):
        row = cls.query.filter_by(key=key).first()
        if row is None:
            return default
        try:
            return json.loads(row.value)
        except Exception:
            return row.value

    @classmethod
    def set(cls, key, value):
        row = cls.query.filter_by(key=key).first()
        serialized = json.dumps(value) if not isinstance(value, str) else value
        if row:
            row.value = serialized
        else:
            row = cls(key=key, value=serialized)
            db.session.add(row)
        db.session.commit()

    @classmethod
    def get_all_as_dict(cls):
        rows = cls.query.all()
        result = {}
        for row in rows:
            try:
                result[row.key] = json.loads(row.value)
            except Exception:
                result[row.key] = row.value
        return result

    @classmethod
    def seed_defaults(cls):
        defaults = {
            "seller_name": "Shresth Saxena",
            "seller_address": "A-109, Kurmanchal Nagar",
            "seller_city": "Bareilly, UP 243122",
            "seller_country": "India",
            "seller_phone": "+918279756297",
            "seller_gstin": "09LZPPS4243G1ZL",
            "seller_pan": "",
            "seller_email": "",
            "bank_name": "",
            "bank_account_number": "",
            "bank_ifsc": "",
            "bank_swift": "",
            "invoice_prefix": "INV",
            "invoice_notes": "Payment due within 15 days of invoice date.",
            "currency": "USD",
            "logo_base64": "",
            "signature_base64": "",
        }
        for key, value in defaults.items():
            existing = cls.query.filter_by(key=key).first()
            if not existing:
                db.session.add(cls(key=key, value=json.dumps(value)))
        db.session.commit()
