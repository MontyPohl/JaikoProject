from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import Notification
from ..services.notification_service import send_notification
from ..utils.jwt_helpers import get_current_user_id

notification_bp = Blueprint("notifications", __name__)


# ── OBTENER NOTIFICACIONES (con paginación) ───────────────────────────────────
@notification_bp.route("/", methods=["GET"])
@jwt_required()
def get_notifications():
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    # BUG CORREGIDO: int(request.args.get(...)) → type=int en ambos params.
    # El min(..., 50) se mantiene para que nadie pueda pedir más de 50 a la vez.
    page = request.args.get("page", 1, type=int) or 1
    per_page = min(request.args.get("per_page", 20, type=int) or 20, 50)

    base_query = Notification.query.filter_by(user_id=user_id)
    total = base_query.count()
    unread = base_query.filter_by(read=False).count()

    notifs = (
        base_query.order_by(Notification.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return (
        jsonify(
            {
                "notifications": [n.to_dict() for n in notifs],
                "unread": unread,
                "total": total,
                "page": page,
                "has_more": (page * per_page) < total,
            }
        ),
        200,
    )


# ── MARCAR UNA NOTIFICACIÓN COMO LEÍDA ───────────────────────────────────────
@notification_bp.route("/<int:notif_id>/read", methods=["PUT"])
@jwt_required()
def mark_read(notif_id):
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    notif = Notification.query.get_or_404(notif_id)
    if notif.user_id != user_id:
        return jsonify({"error": "Acceso denegado"}), 403

    notif.read = True
    db.session.commit()
    return jsonify({"message": "Marcada como leída"}), 200


# ── MARCAR TODAS COMO LEÍDAS ──────────────────────────────────────────────────
@notification_bp.route("/read-all", methods=["PUT"])
@jwt_required()
def mark_all_read():
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    Notification.query.filter_by(user_id=user_id, read=False).update({"read": True})
    db.session.commit()
    return jsonify({"message": "Todas marcadas como leídas"}), 200


# ── ELIMINAR UNA NOTIFICACIÓN ─────────────────────────────────────────────────
@notification_bp.route("/<int:notif_id>", methods=["DELETE"])
@jwt_required()
def delete_notification(notif_id):
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    notif = Notification.query.get_or_404(notif_id)
    if notif.user_id != user_id:
        return jsonify({"error": "Acceso denegado"}), 403

    db.session.delete(notif)
    db.session.commit()
    return jsonify({"message": "Notificación eliminada"}), 200


# ── TEST (solo desarrollo) ────────────────────────────────────────────────────
@notification_bp.route("/send-test", methods=["POST"])
@jwt_required()
def send_test_notification():
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    send_notification(
        user_id=user_id,
        notif_type="system",
        title="Prueba de notificación",
        content="Esta es una notificación de prueba",
        data={"example": True},
    )
    return jsonify({"message": "Notificación de prueba enviada"}), 200
