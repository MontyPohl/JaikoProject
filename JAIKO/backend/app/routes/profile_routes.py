from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_
from ..extensions import db
from ..models import User, Profile
from ..services.matching_service import compute_compatibility

profile_bp = Blueprint("profiles", __name__)


# ── ACTUALIZAR MI PERFIL ──────────────────────────────────────────────────────
@profile_bp.route("/me", methods=["PUT"])
@jwt_required()
def update_my_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    profile = user.profile
    if not profile:
        profile = Profile(user_id=user_id, name="Nuevo Usuario")
        db.session.add(profile)

    data = request.get_json()
    allowed = [
        "name", "age", "gender", "profession", "bio",
        "budget_min", "budget_max", "pets", "smoker",
        "schedule", "diseases", "city", "is_looking",
        "lat", "lng",
        "pref_min_age", "pref_max_age",
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


# ── HELPER: parsear booleano de query string ──────────────────────────────────
def _parse_bool(value):
    """
    Convierte un query param string a bool o None.
    Acepta: "true", "1", "yes" → True
            "false", "0", "no" → False
            None, "" → None (sin filtro)
    """
    if value is None or value == "":
        return None
    return value.lower() in ("true", "1", "yes")


# ── BUSCAR PERFILES COMPATIBLES ───────────────────────────────────────────────
@profile_bp.route("/search", methods=["GET"])
@jwt_required()
def search_profiles():
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get_or_404(current_user_id)
    my_profile = current_user.profile

    city          = request.args.get("city", "Asunción")
    page          = int(request.args.get("page", 1))
    per_page      = int(request.args.get("per_page", 20))
    min_age       = request.args.get("min_age", type=int)
    max_age       = request.args.get("max_age", type=int)
    pets_filter   = _parse_bool(request.args.get("pets"))
    smoker_filter = _parse_bool(request.args.get("smoker"))
    schedule_filter = request.args.get("schedule")

    # FIX: umbral de compatibilidad configurable vía query param (default 50%)
    # Bajamos el default de 80% a 50% para que aparezcan más resultados.
    # El frontend puede pasar ?min_score=80 si quiere el comportamiento antiguo.
    min_score = float(request.args.get("min_score", 50)) / 100.0

    query = (
        Profile.query
        .join(User, User.id == Profile.user_id)
        .filter(
            Profile.user_id != current_user_id,
            Profile.is_looking == True,
            User.status == "active",
            Profile.city == city,
        )
    )

    # Filtros de edad del roomie buscado
    if min_age:
        query = query.filter(Profile.age >= min_age)
    if max_age:
        query = query.filter(Profile.age <= max_age)

    # FIX: filtro de reciprocidad con manejo de NULL.
    # Si pref_min_age o pref_max_age es NULL en el perfil del candidato,
    # lo incluimos (sin preferencia = acepta cualquier edad).
    # Antes: .filter(Profile.pref_min_age <= age) fallaba con NULL porque
    # SQL evalúa NULL <= 25 como NULL (falso), excluyendo a casi todos.
    if my_profile and my_profile.age:
        query = query.filter(
            or_(Profile.pref_min_age == None, Profile.pref_min_age <= my_profile.age)
        )
        query = query.filter(
            or_(Profile.pref_max_age == None, Profile.pref_max_age >= my_profile.age)
        )

    # FIX: usamos el helper _parse_bool para aceptar "true"/"false" y también "1"/"0"
    if pets_filter is not None:
        query = query.filter(Profile.pets == pets_filter)
    if smoker_filter is not None:
        query = query.filter(Profile.smoker == smoker_filter)
    if schedule_filter:
        query = query.filter(Profile.schedule == schedule_filter)

    all_profiles = query.all()

    # Calcular compatibilidad y aplicar umbral mínimo
    results = []
    for p in all_profiles:
        score, matches, mismatches = compute_compatibility(my_profile, p)
        if score >= min_score:
            d = p.to_dict()
            d["compatibility"] = round(score * 100)
            d["matches"] = matches
            d["mismatches"] = mismatches
            results.append(d)

    # Ordenar por compatibilidad descendente
    results.sort(key=lambda x: x["compatibility"], reverse=True)

    # Paginar DESPUÉS de filtrar (comportamiento correcto: página sobre resultados reales)
    total  = len(results)
    paged  = results[(page - 1) * per_page: page * per_page]
    has_more = (page * per_page) < total

    return jsonify({
        "profiles": paged,
        "page": page,
        "total": total,
        "has_more": has_more,
    }), 200