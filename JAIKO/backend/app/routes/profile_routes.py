"""
app/routes/profile_routes.py
─────────────────────────────
Endpoints de perfiles de usuario.

Cambios respecto a la versión anterior:
    1. parse_bool ahora viene de utils.query_helpers (DRY).
       La función _parse_bool local fue reemplazada por el import compartido.
       Comportamiento idéntico — ningún endpoint existente se ve afectado.

    2. GET /profiles/search ahora acepta el parámetro `gender`.
       El frontend (SearchPage.jsx) ya lo envía desde la sesión anterior.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import or_
from ..extensions import db
from ..models import User, Profile
from ..services.matching_service import compute_compatibility
from ..utils.jwt_helpers import get_current_user, get_current_user_id

# ✅ CAMBIO: parse_bool ahora viene del helper compartido.
# Antes vivía aquí como _parse_bool. Misma lógica, sin duplicación.
from ..utils.query_helpers import parse_bool

profile_bp = Blueprint("profiles", __name__)


# ── ACTUALIZAR MI PERFIL ──────────────────────────────────────────────────────
@profile_bp.route("/me", methods=["PUT"])
@jwt_required()
def update_my_profile():
    user, err = get_current_user()
    if err:
        return err
    profile = user.profile
    if not profile:
        profile = Profile(user_id=user.id, name="Nuevo Usuario")
        db.session.add(profile)

    data = request.get_json()
    allowed = [
        "name",
        "age",
        "gender",
        "profession",
        "bio",
        "budget_min",
        "budget_max",
        "pets",
        "smoker",
        "schedule",
        "diseases",
        "city",
        "is_looking",
        "lat",
        "lng",
        "pref_min_age",
        "pref_max_age",
        "profile_photo_url",
    ]
    for field in allowed:
        if field in data:
            setattr(profile, field, data[field])

    db.session.commit()
    return jsonify({"profile": profile.to_dict(include_private=True)}), 200


# ── VER PERFIL DE OTRO USUARIO ────────────────────────────────────────────────
@profile_bp.route("/<int:user_id>", methods=["GET"])
@jwt_required()
def get_profile(user_id):
    user = User.query.get_or_404(user_id)
    if user.is_blocked():
        return jsonify({"error": "Usuario no disponible"}), 404
    return jsonify({"profile": user.profile.to_dict() if user.profile else None}), 200


# ── BUSCAR PERFILES COMPATIBLES ───────────────────────────────────────────────
@profile_bp.route("/search", methods=["GET"])
@jwt_required()
def search_profiles():
    current_user, err = get_current_user()
    if err:
        return err
    my_profile = current_user.profile

    # ── Parámetros de paginación y ciudad ─────────────────────────────────────
    city     = request.args.get("city", "Asunción")
    page     = request.args.get("page",     1,  type=int) or 1
    per_page = request.args.get("per_page", 20, type=int) or 20
    per_page = min(per_page, 100)  # evita requests enormes

    # ── Filtros de perfil ─────────────────────────────────────────────────────
    min_age       = request.args.get("min_age", type=int)
    max_age       = request.args.get("max_age", type=int)
    pets_filter   = parse_bool(request.args.get("pets"))
    smoker_filter = parse_bool(request.args.get("smoker"))

    # or None convierte "" (Cualquiera en el <select>) a None → no filtra
    schedule_filter = request.args.get("schedule") or None

    # ✅ NUEVO: filtro por género.
    #
    # El frontend (SearchPage.jsx) envía ?gender=male / ?gender=female / ?gender=other
    # alineado con el campo `profiles.gender VARCHAR(30)` en la base de datos.
    #
    # El "or None" convierte "" (opción "Cualquiera") a None, para que
    # no se agregue el filtro cuando el usuario no eligió ningún género.
    #
    # Ejemplo de queries válidas:
    #   GET /profiles/search?gender=male
    #   GET /profiles/search?gender=female&city=Asunción
    #   GET /profiles/search              ← sin gender → no filtra
    gender_filter = request.args.get("gender") or None

    try:
        min_score = float(request.args.get("min_score", 50)) / 100.0
    except (ValueError, TypeError):
        min_score = 0.50

    # ── Query base ────────────────────────────────────────────────────────────
    query = Profile.query.join(User, User.id == Profile.user_id).filter(
        Profile.user_id != current_user.id,
        Profile.is_looking == True,
        User.status == "active",
        Profile.city == city,
    )

    # ── Filtros de edad (con manejo de NULL) ──────────────────────────────────
    if min_age:
        query = query.filter(Profile.age >= min_age)
    if max_age:
        query = query.filter(Profile.age <= max_age)

    # Reciprocidad: si mi perfil tiene edad, que los candidatos acepten esa edad.
    # or_(...== None): NULL en pref_min_age/pref_max_age = "acepta cualquier edad"
    if my_profile and my_profile.age:
        query = query.filter(
            or_(Profile.pref_min_age == None, Profile.pref_min_age <= my_profile.age)
        )
        query = query.filter(
            or_(Profile.pref_max_age == None, Profile.pref_max_age >= my_profile.age)
        )

    # ── Filtros booleanos ─────────────────────────────────────────────────────
    if pets_filter is not None:
        query = query.filter(Profile.pets == pets_filter)
    if smoker_filter is not None:
        query = query.filter(Profile.smoker == smoker_filter)

    # ── Filtro de horario ─────────────────────────────────────────────────────
    if schedule_filter:
        query = query.filter(Profile.schedule == schedule_filter)

    # ── ✅ NUEVO: Filtro por género ────────────────────────────────────────────
    # Aplica solo si el usuario eligió un género específico.
    # Mapeo: frontend `gender` → DB `profiles.gender` (mismo nombre, sin mapeo).
    if gender_filter:
        query = query.filter(Profile.gender == gender_filter)

    all_profiles = query.all()

    # ── Compatibilidad y umbral mínimo ────────────────────────────────────────
    results = []
    for p in all_profiles:
        score, matches, mismatches = compute_compatibility(my_profile, p)
        if score >= min_score:
            d = p.to_dict()
            d["compatibility"] = round(score * 100)
            d["matches"]       = matches
            d["mismatches"]    = mismatches
            results.append(d)

    results.sort(key=lambda x: x["compatibility"], reverse=True)

    total    = len(results)
    paged    = results[(page - 1) * per_page : page * per_page]
    has_more = (page * per_page) < total

    return (
        jsonify(
            {
                "profiles": paged,
                "page":     page,
                "total":    total,
                "has_more": has_more,
            }
        ),
        200,
    )
