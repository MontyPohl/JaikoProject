# ─────────────────────────────────────────────────────────────────────────────
# auth_routes.py  —  JAIKO! Backend
# Endpoints: /register  /login  /google  /me  /logout
# ─────────────────────────────────────────────────────────────────────────────
#
# ¿Por qué separamos la autenticación en su propio Blueprint?
# Clean Code recomienda "Separation of Concerns": cada módulo hace UNA cosa.
# auth_routes.py solo gestiona identidad (quién sos). Otros blueprints gestionan
# recursos (grupos, listings, etc.). Esto hace el código más fácil de testear
# y de encontrar cuando algo falla.
#
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt,
    # BUG CORREGIDO: eliminamos get_jwt_identity de este archivo.
    # Antes: user_id = int(get_jwt_identity()) en get_me() → crasheaba si el
    # sub del token no era un entero válido.
    # Ahora: usamos get_current_user() que maneja eso de forma segura y además
    # devuelve 401 (no 404) si el usuario fue eliminado.
    jwt_required,
)
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from ..extensions import db, limiter
from ..models import Profile, TokenBlocklist, User
from ..utils.jwt_helpers import get_current_user

auth_bp = Blueprint("auth", __name__)


# ─────────────────────────────────────────────────────────────────────────────
# HELPER PRIVADO: _build_auth_response
# ─────────────────────────────────────────────────────────────────────────────
# ¿Por qué existe esta función?
# /register, /login y /google devuelven exactamente la misma estructura JSON.
# Si duplicáramos ese código 3 veces, un cambio futuro (agregar un campo al
# user, por ejemplo) requeriría editarlo en 3 lugares y es fácil olvidar uno.
# Este helper centraliza esa lógica — es el principio DRY (Don't Repeat Yourself).
#
def _build_auth_response(user: User, is_new_user: bool = False) -> dict:
    """Construye el dict JSON estándar que el frontend espera al autenticarse."""
    access_token = create_access_token(identity=str(user.id))
    return {
        "access_token": access_token,
        "user": user.to_dict(),
        "profile": user.profile.to_dict(include_private=True) if user.profile else None,
        "is_new_user": is_new_user,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/auth/register
# ─────────────────────────────────────────────────────────────────────────────
# ¿Por qué limitamos a 5/minuto?
# Sin rate limiting, un atacante puede crear miles de cuentas falsas por segundo
# (ataque de registro masivo). 5 intentos/minuto es suficiente para un usuario
# real pero bloquea automatizaciones maliciosas.
#
@auth_bp.route("/register", methods=["POST"])
@limiter.limit("5 per minute")
def register():
    data = request.get_json()

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name:
        return jsonify({"error": "El nombre es requerido"}), 400
    if not email:
        return jsonify({"error": "El email es requerido"}), 400
    if len(password) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "El email ya está registrado"}), 409

    user = User(email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()

    profile = Profile(user_id=user.id, name=name)
    db.session.add(profile)
    db.session.commit()

    return jsonify(_build_auth_response(user, is_new_user=True)), 201


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/auth/login
# ─────────────────────────────────────────────────────────────────────────────
# ¿Por qué el mensaje de error es genérico ("Credenciales incorrectas")?
# Si dijéramos "Email no encontrado" o "Contraseña incorrecta" por separado,
# le indicaríamos al atacante si un email existe en nuestra base de datos
# (ataque de enumeración de usuarios). El mensaje genérico evita eso.
#
@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    data = request.get_json()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        return jsonify({"error": "Credenciales incorrectas"}), 401

    if user.is_blocked():
        return jsonify({"error": "Tu cuenta está suspendida. Contactá soporte."}), 403

    user.last_login = datetime.utcnow()
    db.session.commit()

    return jsonify(_build_auth_response(user)), 200


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/auth/google
# ─────────────────────────────────────────────────────────────────────────────
@auth_bp.route("/google", methods=["POST"])
@limiter.limit("10 per minute")
def google_login():
    data = request.get_json()
    token = data.get("id_token")

    if not token:
        return jsonify({"error": "id_token requerido"}), 400

    try:
        client_id = current_app.config["GOOGLE_CLIENT_ID"]
        id_info = google_id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            client_id,
        )
    except ValueError as e:
        return jsonify({"error": f"Token de Google inválido: {str(e)}"}), 401

    google_sub = id_info.get("sub")
    email = id_info.get("email", "").lower()
    name = id_info.get("name", "Usuario")

    if not email:
        return jsonify({"error": "No se pudo obtener el email de Google"}), 400

    is_new = False
    user = User.query.filter_by(google_id=google_sub).first()

    if not user:
        user = User.query.filter_by(email=email).first()
        if user:
            user.google_id = google_sub
        else:
            is_new = True
            user = User(email=email, google_id=google_sub)
            db.session.add(user)
            db.session.flush()

            profile = Profile(user_id=user.id, name=name)
            db.session.add(profile)

    if user.is_blocked():
        db.session.rollback()
        return jsonify({"error": "Tu cuenta está suspendida. Contactá soporte."}), 403

    user.last_login = datetime.utcnow()
    db.session.commit()

    return jsonify(_build_auth_response(user, is_new_user=is_new)), 200


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/auth/me
# ─────────────────────────────────────────────────────────────────────────────
# ¿Para qué sirve este endpoint?
# Cuando el usuario recarga la página, el frontend tiene el token en
# localStorage pero no tiene los datos del usuario en memoria (Zustand se
# reinicia). Este endpoint permite "rehidratar" el estado del frontend
# sin pedir al usuario que vuelva a loguearse.
#
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    # BUG CORREGIDO: antes usábamos int(get_jwt_identity()) + User.query.get()
    # y devolvíamos 404 si el usuario no existía.
    # Problema doble:
    #   1. int() sin try/except crasheaba con ValueError si el sub no era número.
    #   2. 404 en un endpoint autenticado confunde al frontend — no sabe que
    #      debe limpiar el token y redirigir al login.
    # Ahora get_current_user() devuelve 401 en ambos casos, y el interceptor
    # de Axios en api.js ya maneja el 401 redirigiendo al login automáticamente.
    user, err = get_current_user()
    if err:
        return err

    return (
        jsonify(
            {
                "user": user.to_dict(),
                "profile": (
                    user.profile.to_dict(include_private=True) if user.profile else None
                ),
            }
        ),
        200,
    )


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/auth/logout
# ─────────────────────────────────────────────────────────────────────────────
# ¿Por qué guardamos el token en una "lista negra" (TokenBlocklist)?
# Un JWT es válido por su firma criptográfica hasta que expira (7 días).
# Si solo borramos el token del localStorage, el servidor no sabe que ese
# token ya no debe aceptarse — alguien que lo copió antes del logout
# podría seguir usándolo. Al guardar el jti (JWT ID) en la DB, el callback
# token_in_blocklist_loader en __init__.py rechaza ese token en cada petición.
#
@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    jti = get_jwt()["jti"]

    if not TokenBlocklist.query.filter_by(jti=jti).first():
        db.session.add(TokenBlocklist(jti=jti))
        db.session.commit()

    return jsonify({"message": "Sesión cerrada correctamente"}), 200
