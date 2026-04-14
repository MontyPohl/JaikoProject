"""
Utilidades para manejar JWT de forma segura en todas las rutas.

¿Por qué existe este archivo?
  En Flask-JWT-Extended, get_jwt_identity() devuelve el campo "sub" del token
  como string (ej: "42"). Usábamos int(...) directo en cada ruta, lo que lanza
  ValueError si el sub del token no es un número válido.

  Centralizar esto en una función tiene dos ventajas (Clean Code):
  1. DRY (Don't Repeat Yourself): el manejo del error está en un solo lugar,
     no copiado 42 veces en 12 archivos.
  2. Si algún día cambia cómo Flask-JWT-Extended devuelve la identidad,
     solo hay que actualizar este archivo.
"""

from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from ..models import User


def get_current_user_id() -> int | None:
    """
    Extrae y convierte el user_id del JWT de forma segura.

    Devuelve el id como int, o None si el token tiene un sub inválido.
    Uso típico en una ruta:

        user_id = get_current_user_id()
        if user_id is None:
            return jsonify({"error": "Token inválido"}), 401
    """
    try:
        return int(get_jwt_identity())
    except (TypeError, ValueError):
        return None


def get_current_user():
    """
    Devuelve (user, error_response) donde uno de los dos siempre es None.

    Maneja tres casos en un solo lugar:
      - Token con sub inválido (no es un entero)   → 401
      - Usuario eliminado de la BD con token válido → 401 (no 404)
      - Usuario bloqueado con token válido          → 401

    ¿Por qué 401 y no 404 cuando el usuario no existe?
    El código 404 significa "recurso no encontrado" — correcto para un perfil
    público. Pero en un endpoint autenticado, si el DUEÑO del token no existe,
    el problema es de autenticación, no de recurso. El 401 le indica al
    frontend que debe limpiar el token y redirigir al login.

    Uso típico en una ruta:

        user, err = get_current_user()
        if err:
            return err
        # A partir de aquí `user` es seguro de usar
    """
    user_id = get_current_user_id()
    if user_id is None:
        return None, (
            jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}),
            401,
        )

    user = User.query.get(user_id)
    if user is None:
        return None, (
            jsonify({"error": "Usuario no encontrado. Iniciá sesión nuevamente."}),
            401,
        )

    if user.is_blocked():
        return None, (jsonify({"error": "Tu cuenta está suspendida."}), 401)

    return user, None
