from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import joinedload
from sqlalchemy import func
from ..extensions import db
from ..models import Chat, ChatMember, Message, User
from ..utils.jwt_helpers import get_current_user_id

chat_bp = Blueprint("chats", __name__)


@chat_bp.route("/", methods=["GET"])
@jwt_required()
def get_my_chats():
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    # En este endpoint solo necesitamos el id numérico para filtrar ChatMember,
    # no el objeto User completo, así que usamos get_current_user_id().
    # Si devuelve None, retornamos 401 para que el frontend limpie el token.
    user_id = get_current_user_id()
    if user_id is None:
        return ({"error": "Token inválido. Iniciá sesión nuevamente."}, 401)

    # 1 query: obtener los IDs de chats donde el usuario es miembro
    chat_ids = [
        row.chat_id
        for row in db.session.query(ChatMember.chat_id).filter_by(user_id=user_id).all()
    ]
    if not chat_ids:
        return ({"chats": []}), 200

    # 1 query: cargar chats + miembros + perfiles de usuario de forma eager
    # (evita el problema N+1: sin joinedload haría 1 query por cada miembro)
    chats = (
        Chat.query.filter(Chat.id.in_(chat_ids))
        .options(joinedload(Chat.members).joinedload(ChatMember.user))
        .all()
    )

    # 1 query: obtener el último mensaje por chat usando subquery MAX(id)
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

    result.sort(
        key=lambda c: c["last_message"]["created_at"] if c.get("last_message") else "",
        reverse=True,
    )
    return ({"chats": result}), 200


@chat_bp.route("/private/<int:other_user_id>", methods=["POST"])
@jwt_required()
def get_or_create_private_chat(other_user_id):
    """Obtiene o crea un chat privado 1 a 1."""
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return ({"error": "Token inválido. Iniciá sesión nuevamente."}, 401)

    if user_id == other_user_id:
        return ({"error": "No podés chatear con vos mismo"}), 400

    # Verificar que el otro usuario existe antes de crear el chat
    User.query.get_or_404(other_user_id)

    # Buscar si ya existe un chat privado entre estos dos usuarios:
    # Subconsulta: IDs de chats privados donde el usuario actual es miembro
    my_chats = (
        db.session.query(Chat.id)
        .join(ChatMember, ChatMember.chat_id == Chat.id)
        .filter(Chat.type == "private", ChatMember.user_id == user_id)
        .subquery()
    )
    # De esos chats, ver si el otro usuario también es miembro
    existing = (
        Chat.query.filter(Chat.id.in_(my_chats))
        .join(ChatMember, ChatMember.chat_id == Chat.id)
        .filter(ChatMember.user_id == other_user_id)
        .first()
    )
    if existing:
        return ({"chat": existing.to_dict()}), 200

    # Crear nuevo chat privado con ambos usuarios como miembros
    chat = Chat(type="private")
    db.session.add(chat)
    db.session.flush()  # flush asigna chat.id sin hacer commit todavía
    db.session.add(ChatMember(chat_id=chat.id, user_id=user_id))
    db.session.add(ChatMember(chat_id=chat.id, user_id=other_user_id))
    db.session.commit()
    return ({"chat": chat.to_dict()}), 201


@chat_bp.route("/<int:chat_id>/messages", methods=["GET"])
@jwt_required()
def get_messages(chat_id):
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return ({"error": "Token inválido. Iniciá sesión nuevamente."}, 401)

    # Verificar que el usuario es miembro del chat antes de mostrar mensajes
    member = ChatMember.query.filter_by(chat_id=chat_id, user_id=user_id).first()
    if not member:
        return ({"error": "No sos miembro de este chat"}), 403

    # BUG CORREGIDO: int(request.args.get(...)) → type=int para seguridad
    page = request.args.get("page", 1, type=int) or 1
    per_page = request.args.get("per_page", 50, type=int) or 50

    messages = (
        Message.query.filter_by(chat_id=chat_id)
        .order_by(Message.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    messages.reverse()  # Devolver en orden cronológico ascendente
    return ({"messages": [m.to_dict() for m in messages], "page": page}), 200
