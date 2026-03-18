from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import RoommateRequest, User
from ..services.notification_service import send_notification

# ── Definición del blueprint ───────────────────────────────
request_bp = Blueprint("requests", __name__)

# ── CREAR NUEVA SOLICITUD ─────────────────────────────────
@request_bp.route("/", methods=["POST"])
@jwt_required()
def create_request():
    user_id = int(get_jwt_identity())
    data = request.get_json()

    req_type = data.get("type", "roommate")
    target = data.get("target_user_id")
    group_id = data.get("group_id")
    listing_id = data.get("listing_id")

    if not target and not group_id and not listing_id:
        return jsonify({"error": "target_user_id, group_id, or listing_id required"}), 400

    # Verificar si ya existe una solicitud pendiente similar
    existing = RoommateRequest.query.filter_by(
        sender_user_id=user_id,
        target_user_id=target,
        group_id=group_id,
        listing_id=listing_id,
        status="pending",
    ).first()
    if existing:
        return jsonify({"error": "Request already pending"}), 409

    # Crear la solicitud
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

    # Notificar al destinatario si aplica
    if target:
        send_notification(
            user_id=target,
            type="match_request",
            title="Nueva solicitud de roomie",
            content=f"Alguien quiere ser tu roomie",
            data={"request_id": req.id, "sender_id": user_id},
        )

    db.session.commit()
    return jsonify({"request": req.to_dict()}), 201

# ── RESPONDER A UNA SOLICITUD ─────────────────────────────
@request_bp.route("/<int:req_id>/respond", methods=["PUT"])
@jwt_required()
def respond_request(req_id):
    user_id = int(get_jwt_identity())
    data = request.get_json()
    action = data.get("action")

    if action not in ["accept", "reject"]:
        return jsonify({"error": "Action inválida"}), 400

    # Obtener la solicitud
    req = RoommateRequest.query.get_or_404(req_id)

    # Validar que el usuario sea el receptor
    if req.target_user_id != user_id:
        return jsonify({"error": "No autorizado"}), 403

    # Obtener los usuarios a partir de sus IDs
    sender = User.query.get(req.sender_user_id)
    receiver = User.query.get(req.target_user_id)

    # Validar que ambos existan y tengan perfil
    if not sender or not receiver or not sender.profile or not receiver.profile:
        return jsonify({"error": "Uno de los usuarios no tiene perfil"}), 400

    if action == "accept":
        # ── ACEPTAR SOLICITUD ─────────────────────────────
        req.status = "accepted"

        # Guardar relación de roomies
        sender.profile.current_roomie_id = receiver.id
        receiver.profile.current_roomie_id = sender.id

        # Cambiar estado de búsqueda de roomie
        sender.profile.is_looking = False
        receiver.profile.is_looking = False

        db.session.commit()

        return jsonify({
            "message": "Solicitud aceptada",
            "my_profile": sender.profile.to_dict(),
            "roommate": {
                "id": receiver.id,
                "name": receiver.profile.name,
                "profile_photo_url": receiver.profile.profile_photo_url
            }
        }), 200
    else:
        # ── RECHAZAR SOLICITUD ─────────────────────────────
        req.status = "rejected"
        db.session.commit()
        return jsonify({
            "message": "Solicitud rechazada",
            "redirect": "/notifications"
        }), 200