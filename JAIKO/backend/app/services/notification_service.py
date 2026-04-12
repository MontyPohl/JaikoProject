# JAIKO/backend/app/services/notification_service.py

from ..extensions import db
from ..models import Notification


def send_notification(
    user_id: int,
    notif_type: str,  # ← renombrado de 'type' a 'notif_type'
    title: str,
    content: str = None,
    data: dict = None,
) -> Notification:
    """
    Crea una notificación en la DB y la emite por SocketIO si hay conexión.

    Por qué el parámetro se llama notif_type y no type:
    'type' es un built-in de Python (type(42) → <class 'int'>).
    Usarlo como nombre de parámetro lo pisa dentro del scope de esta función,
    lo que puede causar bugs confusos si en el futuro se necesita type() acá.
    notif_type es igual de claro y no genera ese conflicto.
    """
    notif = Notification(
        user_id=user_id,
        type=notif_type,  # ← el campo del modelo sigue llamándose 'type'
        title=title,
        content=content,
        data=data,
    )
    db.session.add(notif)
    db.session.flush()

    # Emitir notificación en tiempo real por SocketIO
    try:
        from ..extensions import socketio

        socketio.emit(
            "notification",
            notif.to_dict(),
            room=f"user_{user_id}",
        )
    except Exception:
        pass

    return notif
