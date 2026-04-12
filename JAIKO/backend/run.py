import os
import eventlet

# SOLO aplicamos monkey_patch en Railway (Linux). 
# En Windows (os.name == 'nt') NO se ejecuta, manteniendo tu configuración actual.
if os.name != 'nt':
    eventlet.monkey_patch()

from app import create_app
from app.extensions import socketio

app = create_app()

if __name__ == "__main__":
    # Railway inyecta el puerto automáticamente
    port = int(os.environ.get("PORT", 5000))
    
    # En producción (Railway) debug debe ser False
    is_debug = os.environ.get("FLASK_ENV") == "development"

    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=is_debug,
        use_reloader=False,
        allow_unsafe_werkzeug=True
    )
