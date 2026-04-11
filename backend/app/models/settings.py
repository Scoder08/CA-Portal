from app import db
import json
import time

# Per-user cache: {user_id: {key: value}}
_settings_cache: dict[int, dict] = {}
_settings_cache_ts: dict[int, float] = {}
_SETTINGS_TTL = 60  # seconds


class Settings(db.Model):
    __tablename__ = "settings"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    key = db.Column(db.String(100), nullable=False)
    value = db.Column(db.Text, nullable=True)

    __table_args__ = (
        db.UniqueConstraint("user_id", "key", name="uq_settings_user_key"),
    )

    @classmethod
    def get(cls, user_id: int, key: str, default=None):
        row = cls.query.filter_by(user_id=user_id, key=key).first()
        if row is None:
            return default
        try:
            return json.loads(row.value)
        except Exception:
            return row.value

    @classmethod
    def set(cls, user_id: int, key: str, value):
        row = cls.query.filter_by(user_id=user_id, key=key).first()
        serialized = json.dumps(value) if not isinstance(value, str) else value
        if row:
            row.value = serialized
        else:
            db.session.add(cls(user_id=user_id, key=key, value=serialized))
        db.session.commit()

    @classmethod
    def get_all_as_dict(cls, user_id: int) -> dict:
        if user_id in _settings_cache and (time.time() - _settings_cache_ts.get(user_id, 0)) < _SETTINGS_TTL:
            return _settings_cache[user_id]
        rows = cls.query.filter_by(user_id=user_id).all()
        result = {}
        for row in rows:
            try:
                result[row.key] = json.loads(row.value)
            except Exception:
                result[row.key] = row.value
        _settings_cache[user_id] = result
        _settings_cache_ts[user_id] = time.time()
        return result

    @classmethod
    def invalidate_cache(cls, user_id: int):
        _settings_cache.pop(user_id, None)
        _settings_cache_ts.pop(user_id, None)

    @classmethod
    def seed_defaults(cls, user_id: int):
        defaults = {
            "seller_name": "",
            "seller_address": "",
            "seller_city": "",
            "seller_country": "India",
            "seller_phone": "",
            "seller_gstin": "",
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
        # Single query to find which keys already exist
        existing = {
            row.key for row in cls.query.filter_by(user_id=user_id)
            .with_entities(cls.key).all()
        }
        new_rows = [
            cls(user_id=user_id, key=key, value=json.dumps(value))
            for key, value in defaults.items()
            if key not in existing
        ]
        if new_rows:
            db.session.add_all(new_rows)
            db.session.commit()
