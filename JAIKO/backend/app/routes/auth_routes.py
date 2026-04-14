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
    get_jwt_identity,
    jwt_required,
)
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from ..extensions import db, limiter
from ..models import Profile, TokenBlocklist, User

# Blueprint: le dice a Flask que estas rutas pertenecen al grupo "auth".
# __init__.py las registra con url_prefix="/api/auth", así que cada ruta
# aquí es relativa — "/login" se convierte en "/api/auth/login".
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

    # ── Validaciones de entrada ───────────────────────────────────────────────
    # Validamos primero y devolvemos mensajes claros.
    # Beneficio para el usuario: sabe exactamente qué falta completar.
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name:
        return jsonify({"error": "El nombre es requerido"}), 400
    if not email:
        return jsonify({"error": "El email es requerido"}), 400
    if len(password) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400

    # ── Verificar email duplicado ─────────────────────────────────────────────
    # ¿Por qué verificamos antes de hacer commit?
    # Si no chequeamos, la DB lanza IntegrityError (email es UNIQUE).
    # Capturar esa excepción es posible pero devuelve un mensaje genérico.
    # Este chequeo explícito nos permite devolver "El email ya está registrado"
    # — mensaje claro que el usuario entiende.
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "El email ya está registrado"}), 409

    # ── Crear usuario y perfil ────────────────────────────────────────────────
    # Creamos User y Profile en la misma transacción.
    # ¿Por qué? Si el Profile fallara en una segunda transacción, tendríamos
    # un User sin Profile — estado inconsistente que rompería toda la app.
    user = User(email=email)
    user.set_password(
        password
    )  # bcrypt hashea internamente — nunca guardamos texto plano
    db.session.add(user)
    db.session.flush()  # flush() asigna user.id sin hacer commit todavía

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

    # check_password() usa bcrypt para comparar — nunca comparamos texto plano
    if not user or not user.check_password(password):
        return jsonify({"error": "Credenciales incorrectas"}), 401

    if user.is_blocked():
        return jsonify({"error": "Tu cuenta está suspendida. Contactá soporte."}), 403

    # Actualizamos last_login para saber cuándo fue el último acceso
    user.last_login = datetime.utcnow()
    db.session.commit()

    return jsonify(_build_auth_response(user)), 200


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/auth/google
# ─────────────────────────────────────────────────────────────────────────────
# ¿Cómo funciona Google OAuth con id_token?
# 1. El frontend usa el SDK de Google → el usuario hace clic en "Login con Google"
# 2. Google le entrega al frontend un id_token (JWT firmado por Google)
# 3. El frontend envía ese token a NUESTRO backend
# 4. Nuestro backend lo VERIFICA contra los servidores de Google
# 5. Si es válido, extraemos el email y creamos/encontramos el usuario
#
# ¿Por qué verificamos en el backend y no confiamos en el frontend?
# Cualquiera podría fabricar un JSON con "email: admin@jaiko.com" y enviarlo.
# La verificación criptográfica de Google garantiza que el token es auténtico.
#
@auth_bp.route("/google", methods=["POST"])
@limiter.limit("10 per minute")
def google_login():
    data = request.get_json()
    token = data.get("id_token")

    if not token:
        return jsonify({"error": "id_token requerido"}), 400

    # ── Verificar el token con Google ─────────────────────────────────────────
    try:
        client_id = current_app.config["GOOGLE_CLIENT_ID"]
        # google_id_token.verify_oauth2_token hace una petición a los servidores
        # de Google para validar la firma criptográfica del token
        id_info = google_id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            client_id,
        )
    except ValueError as e:
        # ValueError significa que el token es inválido o expiró
        return jsonify({"error": f"Token de Google inválido: {str(e)}"}), 401

    google_sub = id_info.get("sub")  # ID único del usuario en Google
    email = id_info.get("email", "").lower()
    name = id_info.get("name", "Usuario")

    if not email:
        return jsonify({"error": "No se pudo obtener el email de Google"}), 400

    # ── Buscar usuario existente o crear uno nuevo ────────────────────────────
    # Buscamos primero por google_id (más específico), luego por email.
    # ¿Por qué buscar por email también?
    # Un usuario pudo haberse registrado antes con email+contraseña con el
    # mismo email. En ese caso vinculamos su google_id a la cuenta existente
    # en lugar de crear una cuenta duplicada.
    is_new = False
    user = User.query.filter_by(google_id=google_sub).first()

    if not user:
        user = User.query.filter_by(email=email).first()
        if user:
            # Vincular cuenta existente con Google
            user.google_id = google_sub
        else:
            # Crear cuenta nueva
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
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or user.is_blocked():
        return jsonify({"error": "Usuario no encontrado o suspendido"}), 404

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
    jti = get_jwt()["jti"]  # jti = identificador único de ESTE token específico

    # Si por alguna razón el token ya estaba en la blocklist, no fallamos
    if not TokenBlocklist.query.filter_by(jti=jti).first():
        db.session.add(TokenBlocklist(jti=jti))
        db.session.commit()

    return jsonify({"message": "Sesión cerrada correctamente"}), 200
