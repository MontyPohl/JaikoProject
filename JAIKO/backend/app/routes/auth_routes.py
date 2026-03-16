from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from ..extensions import db
from ..models import User, Profile

auth_bp = Blueprint("auth", __name__)

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

        # Asignación directa para evitar errores de Pylance
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

@auth_bp.route("/google", methods=["POST"])
def google_login():
    data = request.get_json()
    token = data.get("token") or data.get("id_token")
    
    if not token:
        return jsonify({"error": "Token requerido"}), 400

    try:
        id_info = id_token.verify_oauth2_token(
            token, google_requests.Request(), current_app.config["GOOGLE_CLIENT_ID"]
        )
    except Exception as e:
        return jsonify({"error": f"Token inválido: {str(e)}"}), 401

    user = User.query.filter_by(email=id_info["email"]).first()

    if not user:
        user = User(email=id_info["email"], google_id=id_info["sub"])
        db.session.add(user)
        db.session.flush()

        profile = Profile()
        profile.user_id = user.id
        profile.name = id_info.get("name", "Usuario Google")
        profile.profile_photo_url = id_info.get("picture")
        db.session.add(profile)
    else:
        user.google_id = id_info["sub"]
        user.last_login = datetime.utcnow()

    db.session.commit()
    access_token = create_access_token(identity=str(user.id))
    return jsonify({"access_token": access_token, "user": user.to_dict()}), 200

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    user = User.query.get(get_jwt_identity())
    return jsonify({
        "user": user.to_dict(),
        "profile": user.profile.to_dict(include_private=True) if user.profile else None
    }), 200