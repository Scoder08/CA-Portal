from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from dotenv import load_dotenv
from sqlalchemy import text, inspect
import os

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

db = SQLAlchemy()

def create_app():
    app = Flask(__name__)

    CORS(app, resources={r"/api/*": {"origins": os.getenv("FRONTEND_URL", "*")}})

    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///ca_portal.db")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,      # drop stale connections before use
        "pool_recycle": 300,        # recycle connections every 5 min
        "connect_args": {"connect_timeout": 10},
    }
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-change-in-prod")
    app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB upload limit

    db.init_app(app)

    from app.routes.auth import auth_bp
    from app.routes.invoice import invoice_bp
    from app.routes.admin import admin_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(invoice_bp, url_prefix="/api/invoice")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok"})

    with app.app_context():
        from app.models.user import User          # noqa: register with metadata
        from app.models.settings import Settings  # noqa
        from app.models.invoice import Invoice    # noqa

        # Drop orphaned sequences from previous failed deploys
        insp = inspect(db.engine)
        with db.engine.begin() as conn:
            for table in db.metadata.tables:
                if not insp.has_table(table):
                    conn.execute(text(f"DROP SEQUENCE IF EXISTS {table}_id_seq"))
        db.create_all()

    return app
