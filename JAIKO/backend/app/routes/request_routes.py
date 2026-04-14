from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import RoommateRequest, User
from ..services.notification_service import send_notification
from ..utils.jwt_helpers import get_current_user_id

request_bp = Blueprint("requests", __name__)


# ── CREAR NUEVA SOLICITUD ─────────────────────────────────────────────────────
@request_bp.route("/", methods=["POST"])
@jwt_required()
def create_request():
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    data = request.get_json()
    req_type = data.get("type", "roommate")
    target = data.get("target_user_id")
    group_id = data.get("group_id")
    listing_id = data.get("listing_id")

    if not target and not group_id and not listing_id:
        return (
            jsonify({"error": "target_user_id, group_id, o listing_id requerido"}),
            400,
        )

    if target and target == user_id:
        return jsonify({"error": "No podés enviarte una solicitud a vos mismo"}), 400

    # Verificar solicitud duplicada pendiente antes de crear una nueva
    existing = RoommateRequest.query.filter_by(
        sender_user_id=user_id,
        target_user_id=target,
        group_id=group_id,
        listing_id=listing_id,
        status="pending",
    ).first()
    if existing:
        return (
            jsonify({"error": "Ya tenés una solicitud pendiente con este usuario"}),
            409,
        )

    req = RoommateRequest(
        sender_user_id=user_id,
        target_user_id=target,
        group_id=group_id,
        listing_id=listing_id,
        type=req_type,
        message=data.get("message"),
    )
    db.session.add(req)
    db.session.flush()

    if target:
        send_notification(
            user_id=target,
            notif_type="match_request",
            title="Nueva solicitud de roomie",
            content="Alguien quiere ser tu roomie",
            data={"request_id": req.id, "sender_id": user_id},
        )

    db.session.commit()
    return jsonify({"request": req.to_dict()}), 201


# ── RESPONDER A UNA SOLICITUD ─────────────────────────────────────────────────
@request_bp.route("/<int:req_id>/respond", methods=["PUT"])
@jwt_required()
def respond_request(req_id):
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    data = request.get_json()
    action = data.get("action")

    if action not in ["accept", "reject"]:
        return jsonify({"error": "Acción inválida. Usar 'accept' o 'reject'"}), 400

    req = RoommateRequest.query.get_or_404(req_id)

    # Solo el receptor puede responder
    if req.target_user_id != user_id:
        return jsonify({"error": "No autorizado"}), 403

    # Solo se puede responder a solicitudes pendientes
    if req.status != "pending":
        return jsonify({"error": f"Esta solicitud ya fue {req.status}"}), 400

    sender = User.query.get(req.sender_user_id)
    receiver = User.query.get(req.target_user_id)

    if not sender or not receiver:
        return jsonify({"error": "Usuario no encontrado"}), 404
    if not sender.profile or not receiver.profile:
        return jsonify({"error": "Uno de los usuarios no tiene perfil completo"}), 400

    if action == "accept":
        req.status = "accepted"

        # Vincular roomies mutuamente y desactivar búsqueda para ambos
        sender.profile.current_roomie_id = receiver.id
        receiver.profile.current_roomie_id = sender.id
        sender.profile.is_looking = False
        receiver.profile.is_looking = False

        db.session.commit()

        send_notification(
            user_id=sender.id,
            notif_type="request_accepted",
            title="¡Solicitud aceptada!",
            content=f"{receiver.profile.name} aceptó tu solicitud de roomie",
            data={
                "request_id": req.id,
                "roommate_id": receiver.id,
                "sender_id": receiver.id,
            },
        )

        return (
            jsonify(
                {
                    "message": "Solicitud aceptada",
                    "roommate": {
                        "id": sender.id,
                        "name": sender.profile.name,
                        "profile_photo_url": sender.profile.profile_photo_url,
                    },
                }
            ),
            200,
        )

    else:
        req.status = "rejected"
        db.session.commit()

        send_notification(
            user_id=sender.id,
            notif_type="request_rejected",
            title="Solicitud no aceptada",
            content=f"{receiver.profile.name} no aceptó tu solicitud",
            data={"request_id": req.id},
        )

        return jsonify({"message": "Solicitud rechazada"}), 200


# ── LISTAR SOLICITUDES RECIBIDAS PENDIENTES ───────────────────────────────────
@request_bp.route("/pending", methods=["GET"])
@jwt_required()
def get_pending_requests():
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    reqs = (
        RoommateRequest.query.filter_by(target_user_id=user_id, status="pending")
        .order_by(RoommateRequest.created_at.desc())
        .all()
    )
    return jsonify({"requests": [r.to_dict() for r in reqs]}), 200


# ── LISTAR SOLICITUDES ENVIADAS ───────────────────────────────────────────────
@request_bp.route("/sent", methods=["GET"])
@jwt_required()
def get_sent_requests():
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    reqs = (
        RoommateRequest.query.filter_by(sender_user_id=user_id)
        .order_by(RoommateRequest.created_at.desc())
        .all()
    )
    return jsonify({"requests": [r.to_dict() for r in reqs]}), 200


# ── CANCELAR SOLICITUD ENVIADA ────────────────────────────────────────────────
@request_bp.route("/<int:req_id>/cancel", methods=["DELETE"])
@jwt_required()
def cancel_request(req_id):
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    req = RoommateRequest.query.get_or_404(req_id)

    if req.sender_user_id != user_id:
        return jsonify({"error": "No autorizado"}), 403
    if req.status != "pending":
        return jsonify({"error": "Solo se pueden cancelar solicitudes pendientes"}), 400

    req.status = "cancelled"
    db.session.commit()
    return jsonify({"message": "Solicitud cancelada"}), 200
