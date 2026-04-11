from app import db
from datetime import datetime
import json


class Invoice(db.Model):
    __tablename__ = "invoices"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    invoice_number = db.Column(db.String(100), nullable=False)
    client_name = db.Column(db.String(255), nullable=False, default="")
    amount = db.Column(db.Float, nullable=False, default=0)
    currency = db.Column(db.String(10), nullable=False, default="USD")
    issue_date = db.Column(db.String(20), nullable=True)
    due_date = db.Column(db.String(20), nullable=True)
    deel_ref = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="unpaid")  # paid | unpaid
    parsed_data = db.Column(db.Text, nullable=True)  # JSON snapshot for PDF regeneration
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "invoice_number": self.invoice_number,
            "client_name": self.client_name,
            "amount": self.amount,
            "currency": self.currency,
            "issue_date": self.issue_date,
            "due_date": self.due_date,
            "deel_ref": self.deel_ref,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
        }
