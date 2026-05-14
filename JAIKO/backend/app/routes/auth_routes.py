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

from flask import Blueprint, current_app, jsonify, make_response, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt,
    # BUG CORREGIDO: eliminamos get_jwt_identity de este archivo.
    # Antes: user_id = int(get_jwt_identity()) en get_me() → crasheaba si el
    # sub del token no era un entero válido.
    # Ahora: usamos get_current_user() que maneja eso de forma segura y además
    # devuelve 401 (no 404) si el usuario fue eliminado.
    jwt_required,
    set_access_cookies,  # ← escribe la cookie httpOnly en la respuesta
    unset_jwt_cookies,  # ← limpia la cookie al hacer logout
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
def _build_auth_response(user: User, is_new_user: bool = False):
    """
    Construye la respuesta de autenticación con cookie httpOnly.

    Qué cambia respecto a antes:
    - Ya no devolvemos access_token en el body para que el frontend
      lo guarde en localStorage (eso era el problema).
    - Seteamos una cookie httpOnly que el browser maneja solo.
    - Sí devolvemos el token en el body como 'socket_token', pero SOLO
      para que el cliente lo use en la conexión WebSocket (en memoria,
      nunca en localStorage).

    Por qué necesitamos socket_token por separado:
    Los WebSockets no envían cookies automáticamente de la misma forma
    que HTTP. Guardamos este token en el estado de Zustand (RAM),
    que desaparece al cerrar el tab — mucho más seguro que localStorage.

    IMPORTANTE: devuelve un objeto Response (no un dict).
    Los endpoints que lo usan deben hacer:
        return _build_auth_response(user), 201
    NO:
        return jsonify(_build_auth_response(user)), 201   # ← rompe la cookie
    """
    access_token = create_access_token(identity=str(user.id))

    # Construimos el body de la respuesta SIN el token de API
    body = {
        "socket_token": access_token,  # Solo para WebSocket, guardar en memoria
        "user": user.to_dict(),
        "profile": user.profile.to_dict(include_private=True) if user.profile else None,
        "is_new_user": is_new_user,
    }

    # make_response nos permite tanto devolver JSON como setear cookies
    response = make_response(jsonify(body))

    # set_access_cookies usa la configuración de config.py para setear
    # la cookie con httponly=True, secure=True (prod), samesite="Lax"
    set_access_cookies(response, access_token)

    return response


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

    # _build_auth_response ya devuelve un Response con la cookie seteada.
    # NO envolver en jsonify() — eso perdería la cookie.
    return _build_auth_response(user, is_new_user=True), 201


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

    return _build_auth_response(user), 200


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

    return _build_auth_response(user, is_new_user=is_new), 200


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/auth/me
# ─────────────────────────────────────────────────────────────────────────────
# ¿Para qué sirve este endpoint?
# Cuando el usuario recarga la página, el frontend pierde el estado en memoria
# (Zustand se reinicia) pero la cookie httpOnly sigue presente. Este endpoint
# permite "rehidratar" el estado del frontend usando esa cookie, sin pedir
# al usuario que vuelva a loguearse.
#
# BUG CORREGIDO: antes este bloque tenía los decoradores @auth_bp.route y
# @jwt_required DUPLICADOS, lo que causaba el error en producción:
#   AssertionError: View function mapping is overwriting an existing
#   endpoint function: auth.get_me
#
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    user, err = get_current_user()
    if err:
        return err

    # Generamos un token fresco para WebSocket.
    # Esto permite que al recargar la página, el WebSocket
    # vuelva a conectarse sin pedirle al usuario que haga login de nuevo.
    fresh_socket_token = create_access_token(identity=str(user.id))

    response = make_response(
        jsonify(
            {
                "socket_token": fresh_socket_token,
                "user": user.to_dict(),
                "profile": (
                    user.profile.to_dict(include_private=True) if user.profile else None
                ),
            }
        )
    )

    # Aprovechamos para renovar la cookie también (extiende la sesión)
    set_access_cookies(response, fresh_socket_token)

    return response, 200


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
    """
    Cierra sesión: invalida el token en la blocklist Y limpia la cookie.

    Por qué hacer ambas cosas:
    - La blocklist invalida el JWT aunque alguien tenga una copia.
    - unset_jwt_cookies() setea la cookie con Max-Age=0, lo que le
      dice al browser que la elimine inmediatamente.
    Sin ambos pasos, la sesión no cierra completamente.
    """
    jti = get_jwt()["jti"]

    if not TokenBlocklist.query.filter_by(jti=jti).first():
        db.session.add(TokenBlocklist(jti=jti))
        db.session.commit()

    # Crear respuesta y limpiar la cookie
    response = make_response(jsonify({"message": "Sesión cerrada correctamente"}))
    unset_jwt_cookies(response)
    return response, 200
