"""
CA AI Agent — Flask SSE blueprint.

Endpoints:
  GET  /api/agent/sessions                     — list user's chat sessions
  GET  /api/agent/sessions/<id>/messages       — history for a session
  POST /api/agent/chat                         — streaming SSE chat endpoint
  DELETE /api/agent/sessions/<id>              — delete a session
"""

import json
import logging
import time
from collections import defaultdict
from threading import Lock

from flask import Blueprint, Response, current_app, g, jsonify, request, stream_with_context

from app import db
from app.models.chat import ChatMessage, ChatSession
from app.routes.auth import require_auth

logger = logging.getLogger(__name__)
agent_bp = Blueprint("agent", __name__)

# Appended automatically after every response — never depends on the LLM to include it
_DISCLAIMER = (
    "\n\n---\n*This is an AI-generated estimate for informational purposes only. "
    "For official filings and legal advice, consult a practising Chartered Accountant "
    "registered with ICAI.*"
)

# ---------------------------------------------------------------------------
# Simple in-process rate limiter (per user): max 20 req / 60 seconds
# In production with multiple workers, use Redis instead.
# ---------------------------------------------------------------------------
_rate_lock = Lock()
_rate_store: dict[int, list[float]] = defaultdict(list)
_RATE_LIMIT = 20
_RATE_WINDOW = 60  # seconds


def _is_rate_limited(user_id: int) -> bool:
    now = time.time()
    with _rate_lock:
        timestamps = _rate_store[user_id]
        # Purge old timestamps outside the window
        _rate_store[user_id] = [t for t in timestamps if now - t < _RATE_WINDOW]
        if len(_rate_store[user_id]) >= _RATE_LIMIT:
            return True
        _rate_store[user_id].append(now)
        return False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_or_create_session(user_id: int, session_id: int | None) -> ChatSession:
    if session_id:
        session = ChatSession.query.filter_by(id=session_id, user_id=user_id).first()
        if session:
            return session
    session = ChatSession(user_id=user_id)
    db.session.add(session)
    db.session.commit()
    return session


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@agent_bp.route("/sessions", methods=["GET"])
@require_auth
def list_sessions():
    sessions = (
        ChatSession.query
        .filter_by(user_id=g.user_id)
        .order_by(ChatSession.updated_at.desc())
        .limit(20)
        .all()
    )
    return jsonify([s.to_dict() for s in sessions])


@agent_bp.route("/sessions/<int:session_id>/messages", methods=["GET"])
@require_auth
def get_messages(session_id: int):
    session = ChatSession.query.filter_by(id=session_id, user_id=g.user_id).first()
    if not session:
        return jsonify({"error": "Session not found"}), 404
    messages = session.messages.order_by(ChatMessage.created_at).all()
    return jsonify([m.to_dict() for m in messages])


@agent_bp.route("/sessions/<int:session_id>", methods=["DELETE"])
@require_auth
def delete_session(session_id: int):
    session = ChatSession.query.filter_by(id=session_id, user_id=g.user_id).first()
    if not session:
        return jsonify({"error": "Session not found"}), 404
    db.session.delete(session)
    db.session.commit()
    return jsonify({"success": True})


@agent_bp.route("/chat", methods=["POST"])
@require_auth
def chat():
    """
    Streaming SSE endpoint for the CA AI agent.

    Request body:
        { "message": "<user text>", "session_id": <int|null> }

    Response: text/event-stream
        data: {"session_id": N, "type": "meta"}   — first event (session context)
        data: <token>                              — one event per token
        data: [DONE]                               — stream complete
        data: {"error": "...", "type": "error"}   — on unrecoverable error
    """
    if _is_rate_limited(g.user_id):
        return jsonify({"error": "Too many requests. Please wait a moment."}), 429

    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()
    session_id = data.get("session_id")

    if not user_message:
        return jsonify({"error": "message is required"}), 400

    if len(user_message) > 4000:
        return jsonify({"error": "Message too long (max 4000 characters)"}), 400

    session = _get_or_create_session(g.user_id, session_id)

    # Persist user message immediately so it's in the DB before streaming starts
    user_msg_row = ChatMessage(
        session_id=session.id,
        role="user",
        content=user_message,
    )
    db.session.add(user_msg_row)
    db.session.commit()

    # Load conversation history (last 20 messages for context window management)
    history = [
        {"role": m.role, "content": m.content}
        for m in (
            ChatMessage.query
            .filter_by(session_id=session.id)
            .filter(ChatMessage.id != user_msg_row.id)
            .order_by(ChatMessage.created_at)
            .limit(20)
            .all()
        )
    ]

    # Capture request-scoped values before entering the generator
    # (Flask's g and current_app proxies are not safe inside the generator)
    user_id = g.user_id
    session_id_val = session.id
    app = current_app._get_current_object()

    def generate():
        from app.services.ca_agent import stream_agent_response

        accumulated: list[str] = []

        try:
            # First SSE event: session metadata so the frontend can persist the session_id
            yield f"data: {json.dumps({'session_id': session_id_val, 'type': 'meta'})}\n\n"

            for chunk in stream_agent_response(user_id, history, user_message):
                if chunk == "data: [DONE]\n\n":
                    # Append disclaimer as a final token before closing
                    accumulated.append(_DISCLAIMER)
                    yield f"data: {_DISCLAIMER}\n\n"
                    yield chunk
                    break
                # Strip SSE envelope to extract the raw token for accumulation
                token = chunk[len("data: "):-len("\n\n")]
                accumulated.append(token)
                yield chunk

        except GeneratorExit:
            # Client disconnected mid-stream — still persist what we have
            logger.info("Client disconnected during stream for session %s", session_id_val)
        except Exception as exc:
            logger.exception("Unexpected error in SSE generator for session %s", session_id_val)
            yield f"data: {json.dumps({'error': 'Internal error. Please try again.', 'type': 'error'})}\n\n"
            yield "data: [DONE]\n\n"
        finally:
            # Persist the assistant's complete response to DB
            assistant_text = "".join(accumulated).strip()
            if assistant_text:
                with app.app_context():
                    try:
                        msg = ChatMessage(
                            session_id=session_id_val,
                            role="assistant",
                            content=assistant_text,
                        )
                        db.session.add(msg)
                        # Touch the session's updated_at
                        sess = db.session.get(ChatSession, session_id_val)
                        if sess:
                            from datetime import datetime
                            sess.updated_at = datetime.utcnow()
                        db.session.commit()
                    except Exception:
                        logger.exception(
                            "Failed to persist assistant message for session %s",
                            session_id_val,
                        )

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx/Render proxy buffering
            "Connection": "keep-alive",
        },
    )
