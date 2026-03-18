# NO se usa eventlet.monkey_patch() porque en Windows causa que los
# socketio.emit() a rooms de otros clientes fallen silenciosamente.
# Flask-SocketIO con async_mode="threading" maneja la concurrencia
# correctamente sin necesidad de monkey patching.

from app import create_app
from app.extensions import socketio

app = create_app()

if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=True,
        use_reloader=False,      # Reloader crea proceso hijo que rompe los sockets
        allow_unsafe_werkzeug=True
    )