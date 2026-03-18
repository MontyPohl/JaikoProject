from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_socketio import SocketIO
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_bcrypt import Bcrypt

db = SQLAlchemy()
migrate = Migrate()
# Configuramos CORS aquí y async_mode=eventlet
socketio = SocketIO(cors_allowed_origins="*", async_mode="eventlet")
jwt = JWTManager()
cors = CORS()
bcrypt = Bcrypt()