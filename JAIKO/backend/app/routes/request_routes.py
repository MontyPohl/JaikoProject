from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import RoommateRequest, User, Chat, ChatMember, Profile
from ..services.notification_service import send_notification
from ..utils.jwt_helpers import get_current_user_id

request_bp = Blueprint("requests", __name__)


# ── CREAR NUEVA SOLICITUD ─────────────────────────────────────────────────────
@request_bp.route("/", methods=["POST"])
@jwt_required()
def create_request():
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
        # ── CAMBIO: incluir el nombre del remitente en la notificación ────────
        # Antes decía "Alguien quiere ser tu roomie" sin identificar quién.
        # Ahora buscamos el perfil del sender para mostrar su nombre real.
        sender_user = User.query.get(user_id)
        sender_name = (
            sender_user.profile.name
            if sender_user and sender_user.profile and sender_user.profile.name
            else "Un usuario"
        )

        send_notification(
            user_id=target,
            notif_type="match_request",
            title=f"{sender_name} quiere ser tu roomie",
            content=f"{sender_name} te envió una solicitud. Entrá a su perfil para aceptar o rechazar.",
            data={"request_id": req.id, "sender_id": user_id},
        )

    db.session.commit()
    return jsonify({"request": req.to_dict()}), 201


# ── RESPONDER A UNA SOLICITUD ─────────────────────────────────────────────────
@request_bp.route("/<int:req_id>/respond", methods=["PUT"])
@jwt_required()
def respond_request(req_id):
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

        # ── Crear chat privado automáticamente ───────────────────────────────
        # Al aceptar, los roomies ya pueden chatear. Buscamos si ya existe
        # un chat privado entre ellos para no duplicarlo.
        existing_chat_ids = (
            db.session.query(ChatMember.chat_id)
            .join(Chat, Chat.id == ChatMember.chat_id)
            .filter(Chat.type == "private", ChatMember.user_id == sender.id)
            .subquery()
        )
        chat_already_exists = (
            Chat.query.filter(Chat.id.in_(existing_chat_ids))
            .join(ChatMember, ChatMember.chat_id == Chat.id)
            .filter(ChatMember.user_id == receiver.id)
            .first()
        )
        if not chat_already_exists:
            new_chat = Chat(type="private")
            db.session.add(new_chat)
            db.session.flush()
            db.session.add(ChatMember(chat_id=new_chat.id, user_id=sender.id))
            db.session.add(ChatMember(chat_id=new_chat.id, user_id=receiver.id))

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
@request_bp.route("/received", methods=["GET"])
@jwt_required()
def get_received_requests():
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    reqs = RoommateRequest.query.filter_by(
        target_user_id=user_id, status="pending"
    ).all()
    return jsonify({"requests": [r.to_dict() for r in reqs]}), 200


# ── DEJAR DE SER ROOMIE ───────────────────────────────────────────────────────
# Consulta Profile directamente (no por relación lazy) para evitar
# problemas de caché de SQLAlchemy session.
@request_bp.route("/leave-roomie", methods=["POST"])
@jwt_required()
def leave_roomie():
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    my_profile = Profile.query.filter_by(user_id=user_id).first()
    if not my_profile:
        return jsonify({"error": "Perfil no encontrado"}), 404

    roomie_id = my_profile.current_roomie_id
    if not roomie_id:
        return jsonify({"error": "No tenés roomie actualmente"}), 400

    # Limpiar mi lado
    my_profile.current_roomie_id = None
    my_profile.is_looking = True

    # Limpiar el lado del roomie
    roomie_profile = Profile.query.filter_by(user_id=roomie_id).first()
    if roomie_profile:
        roomie_profile.current_roomie_id = None
        roomie_profile.is_looking = True

    db.session.commit()
    return jsonify({"message": "Ya no son roomies"}), 200
