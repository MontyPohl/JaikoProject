from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from ..extensions import db
from ..models import User, Profile

auth_bp = Blueprint("auth", __name__)

# --- REGISTRO TRADICIONAL ---
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email y contraseña requeridos"}), 400

    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "El usuario ya existe"}), 400

    try:
        new_user = User(email=data["email"])
        new_user.set_password(data["password"])
        db.session.add(new_user)
        db.session.flush()

        new_profile = Profile()
        new_profile.user_id = new_user.id
        new_profile.name = data.get("name", "Nuevo Usuario")
        
        db.session.add(new_profile)
        db.session.commit()

        access_token = create_access_token(identity=str(new_user.id))
        return jsonify({"access_token": access_token, "user": new_user.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --- LOGIN TRADICIONAL ---
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data.get("email")).first()

    if user and user.check_password(data.get("password")):
        if user.is_blocked():
            return jsonify({"error": "Cuenta bloqueada"}), 403

        user.last_login = datetime.utcnow()
        db.session.commit()
        access_token = create_access_token(identity=str(user.id))
        return jsonify({"access_token": access_token, "user": user.to_dict()}), 200

    return jsonify({"error": "Credenciales inválidas"}), 401

# --- LOGIN CON GOOGLE (Optimizado para React) ---
@auth_bp.route("/google", methods=["POST"])
def google_login():
    data = request.get_json()
    token = data.get("token") or data.get("id_token")
    
    if not token:
        return jsonify({"error": "Token de Google requerido"}), 400

    try:
        # Aquí current_app funciona porque estamos DENTRO de una ruta
        client_id = current_app.config["GOOGLE_CLIENT_ID"]
        
        id_info = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            client_id
        )
    except Exception as e:
        return jsonify({"error": f"Token inválido: {str(e)}"}), 401

    email = id_info["email"]
    google_id = id_info["sub"] # El ID único de Google

    user = User.query.filter_by(email=email).first()

    if not user:
        # Crear usuario nuevo
        user = User(email=email, google_id=google_id)
        db.session.add(user)
        db.session.flush()

        # Crear perfil
        profile = Profile()
        profile.user_id = user.id
        profile.name = id_info.get("name", "Usuario Google")
        profile.profile_photo_url = id_info.get("picture")
        db.session.add(profile)
    else:
        user.google_id = google_id
        user.last_login = datetime.utcnow()

    db.session.commit()

    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        "access_token": access_token, 
        "user": user.to_dict(),
        "profile": user.profile.to_dict() if user.profile else None
    }), 200

# --- OBTENER MI PERFIL ---
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "Usuario no encontrado"}), 404
        
    return jsonify({
        "user": user.to_dict(),
        "profile": user.profile.to_dict(include_private=True) if user.profile else None
    }), 200