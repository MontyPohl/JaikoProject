from datetime import datetime
from flask import request
from flask_socketio import emit, join_room, leave_room, disconnect
from flask_jwt_extended import decode_token
from ..extensions import socketio, db
from ..models import Chat, ChatMember, Message


def _authenticate_socket() -> int | None:
    token = request.args.get("token") or (request.headers.get("Authorization", "").replace("Bearer ", ""))
    if not token:
        return None
    try:
        decoded = decode_token(token)
        return int(decoded["sub"])
    except Exception:
        return None


@socketio.on("connect")
def on_connect():
    user_id = _authenticate_socket()
    if not user_id:
        disconnect()
        return False
    join_room(f"user_{user_id}")
    emit("connected", {"user_id": user_id})
    print(f"[SOCKET] Usuario {user_id} conectado")


@socketio.on("disconnect")
def on_disconnect():
    user_id = _authenticate_socket()
    if user_id:
        leave_room(f"user_{user_id}")
        print(f"[SOCKET] Usuario {user_id} desconectado")


@socketio.on("join_chat")
def on_join_chat(data):
    user_id = _authenticate_socket()
    if not user_id:
        return
    chat_id = data.get("chat_id")
    member = ChatMember.query.filter_by(chat_id=chat_id, user_id=user_id).first()
    if not member:
        emit("error", {"message": "Not a member of this chat"})
        return
    room = f"chat_{chat_id}"
    join_room(room)
    print(f"[SOCKET] Usuario {user_id} unido al room {room}")
    emit("joined_chat", {"chat_id": chat_id})


@socketio.on("leave_chat")
def on_leave_chat(data):
    user_id = _authenticate_socket()
    if not user_id:
        return
    chat_id = data.get("chat_id")
    leave_room(f"chat_{chat_id}")


@socketio.on("send_message")
def on_send_message(data):
    user_id = _authenticate_socket()
    if not user_id:
        return

    chat_id = data.get("chat_id")
    content = data.get("content", "").strip()

    if not chat_id or not content:
        emit("error", {"message": "chat_id and content are required"})
        return

    member = ChatMember.query.filter_by(chat_id=chat_id, user_id=user_id).first()
    if not member:
        emit("error", {"message": "Not a member of this chat"})
        return

    msg = Message(
        chat_id=chat_id,
        sender_id=user_id,
        content=content,
        type=data.get("type", "text"),
    )
    db.session.add(msg)
    member.last_read_at = datetime.utcnow()
    db.session.commit()

    msg_dict = msg.to_dict()

    # CORRECCIÓN CRÍTICA: usar emit() con to= (handler-scoped) en lugar de
    # socketio.emit() (module-level). Con async_mode="threading", la versión
    # module-level falla para emitir a otros clientes desde un event handler.
    # La versión handler-scoped tiene el contexto correcto garantizado.

    # 1. Emitir a todos en el room del chat (incluye al emisor)
    emit("receive_message", msg_dict, to=f"chat_{chat_id}")
    print(f"[SOCKET] Mensaje emitido al room chat_{chat_id}")

    # 2. Emitir al room personal de cada miembro (por si no tienen join_chat activo)
    chat = Chat.query.filter_by(id=chat_id).first()
    if chat:
        for cm in chat.members:
            if cm.user_id != user_id:
                emit("receive_message", msg_dict, to=f"user_{cm.user_id}")
                print(f"[SOCKET] Mensaje emitido al room user_{cm.user_id}")

    # 3. Notificaciones push
    sender_profile = msg.sender.profile
    sender_name = sender_profile.name if sender_profile else "Alguien"
    from ..services.notification_service import send_notification
    if chat:
        for cm in chat.members:
            if cm.user_id != user_id:
                send_notification(
                    user_id=cm.user_id,
                    type="message",
                    title=f"Nuevo mensaje de {sender_name}",
                    content=content[:100],
                    data={"chat_id": chat_id},
                )


@socketio.on("typing")
def on_typing(data):
    user_id = _authenticate_socket()
    if not user_id:
        return
    chat_id = data.get("chat_id")
    emit("user_typing", {"user_id": user_id, "chat_id": chat_id},
         to=f"chat_{chat_id}", include_self=False)


@socketio.on("stop_typing")
def on_stop_typing(data):
    user_id = _authenticate_socket()
    if not user_id:
        return
    chat_id = data.get("chat_id")
    emit("user_stop_typing", {"user_id": user_id, "chat_id": chat_id},
         to=f"chat_{chat_id}", include_self=False)
    