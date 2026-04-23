from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import joinedload
from sqlalchemy import func
from ..extensions import db
from ..models import Chat, ChatMember, Message, User, GroupMember
from ..utils.jwt_helpers import get_current_user_id

chat_bp = Blueprint("chats", __name__)


@chat_bp.route("/", methods=["GET"])
@jwt_required()
def get_my_chats():
    user_id = get_current_user_id()
    if user_id is None:
        return ({"error": "Token inválido. Iniciá sesión nuevamente."}, 401)

    chat_ids = [
        row.chat_id
        for row in db.session.query(ChatMember.chat_id).filter_by(user_id=user_id).all()
    ]
    if not chat_ids:
        return ({"chats": []}), 200

    chats = (
        Chat.query.filter(Chat.id.in_(chat_ids))
        .options(joinedload(Chat.members).joinedload(ChatMember.user))
        .all()
    )

    last_msg_subq = (
        db.session.query(func.max(Message.id))
        .filter(Message.chat_id.in_(chat_ids))
        .group_by(Message.chat_id)
        .subquery()
    )
    last_messages = (
        Message.query.filter(Message.id.in_(last_msg_subq))
        .options(joinedload(Message.sender))
        .all()
    )
    last_msg_by_chat = {m.chat_id: m for m in last_messages}

    result = []
    for chat in chats:
        last_msg = last_msg_by_chat.get(chat.id)
        result.append(
            {
                "id": chat.id,
                "type": chat.type,
                "group_id": chat.group_id,
                "listing_id": chat.listing_id,
                "members": [m.to_dict() for m in chat.members],
                "last_message": last_msg.to_dict() if last_msg else None,
                "created_at": chat.created_at.isoformat(),
            }
        )

    # Ordenar: chats con mensajes primero por fecha del último mensaje.
    # Chats vacíos (roomie recién vinculado) ordenan por fecha de creación.
    result.sort(
        key=lambda c: (
            c["last_message"]["created_at"]
            if c.get("last_message")
            else c["created_at"]
        ),
        reverse=True,
    )
    return ({"chats": result}), 200


@chat_bp.route("/private/<int:other_user_id>", methods=["POST"])
@jwt_required()
def get_or_create_private_chat(other_user_id):
    """Obtiene o crea un chat privado entre roomies."""
    user_id = get_current_user_id()
    if user_id is None:
        return ({"error": "Token inválido. Iniciá sesión nuevamente."}, 401)

    if user_id == other_user_id:
        return ({"error": "No podés chatear con vos mismo"}), 400

    current_user = User.query.get(user_id)
    other_user   = User.query.get_or_404(other_user_id)

    my_profile    = current_user.profile if current_user else None
    other_profile = other_user.profile

    # ── Verificar si son roomies (ambas direcciones) ──────────────────────────
    # current_roomie_id es el ID del roomie actual guardado en el perfil.
    # Chequeamos ambas direcciones por si la relación quedó registrada
    # en un solo lado.
    are_roomies = bool(
        my_profile and other_profile and (
            my_profile.current_roomie_id == other_user_id
            or other_profile.current_roomie_id == user_id
        )
    )

    if not are_roomies:
        # ── Verificar si están en el mismo grupo ──────────────────────────────
        my_group    = GroupMember.query.filter_by(user_id=user_id,       status="active").first()
        other_group = GroupMember.query.filter_by(user_id=other_user_id, status="active").first()

        if my_group and other_group and my_group.group_id == other_group.group_id:
            group_chat = Chat.query.filter_by(
                type="group", group_id=my_group.group_id
            ).first()
            return (
                {
                    "error": "Están en el mismo grupo. Usá el chat grupal.",
                    "code": "SAME_GROUP",
                    "group_chat_id": group_chat.id if group_chat else None,
                }
            ), 403

        return ({"error": "Solo podés chatear con tu roomie actual"}), 403

    # ── Buscar si ya existe un chat privado entre los dos ────────────────────
    my_chats = (
        db.session.query(Chat.id)
        .join(ChatMember, ChatMember.chat_id == Chat.id)
        .filter(Chat.type == "private", ChatMember.user_id == user_id)
        .subquery()
    )
    existing = (
        Chat.query.filter(Chat.id.in_(my_chats))
        .join(ChatMember, ChatMember.chat_id == Chat.id)
        .filter(ChatMember.user_id == other_user_id)
        .first()
    )
    if existing:
        return ({"chat": existing.to_dict()}), 200

    # ── Crear chat si no existe (fallback por si request_routes no lo hizo) ──
    chat = Chat(type="private")
    db.session.add(chat)
    db.session.flush()
    db.session.add(ChatMember(chat_id=chat.id, user_id=user_id))
    db.session.add(ChatMember(chat_id=chat.id, user_id=other_user_id))
    db.session.commit()
    return ({"chat": chat.to_dict()}), 201


@chat_bp.route("/<int:chat_id>/messages", methods=["GET"])
@jwt_required()
def get_messages(chat_id):
    user_id = get_current_user_id()
    if user_id is None:
        return ({"error": "Token inválido. Iniciá sesión nuevamente."}, 401)

    member = ChatMember.query.filter_by(chat_id=chat_id, user_id=user_id).first()
    if not member:
        return ({"error": "No sos miembro de este chat"}), 403

    page     = request.args.get("page",     1,  type=int) or 1
    per_page = request.args.get("per_page", 50, type=int) or 50

    messages = (
        Message.query.filter_by(chat_id=chat_id)
        .order_by(Message.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    messages.reverse()
    return ({"messages": [m.to_dict() for m in messages], "page": page}), 200
