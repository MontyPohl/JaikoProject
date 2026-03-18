from ..extensions import db
from ..models import Notification

def send_notification(user_id: int, type: str, title: str, content: str = None, data: dict = None) -> Notification:
    """Create a DB notification and emit via SocketIO if connected."""
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        content=content,
        data=data,  # <-- importante para frontend
    )
    db.session.add(notif)
    db.session.flush()

    # Emit real-time notification via SocketIO
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