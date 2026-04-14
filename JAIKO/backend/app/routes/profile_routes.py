from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import or_
from ..extensions import db
from ..models import User, Profile
from ..services.matching_service import compute_compatibility
from ..utils.jwt_helpers import get_current_user, get_current_user_id

profile_bp = Blueprint("profiles", __name__)


# ── ACTUALIZAR MI PERFIL ──────────────────────────────────────────────────────
@profile_bp.route("/me", methods=["PUT"])
@jwt_required()
def update_my_profile():
    # BUG #1 y #3 CORREGIDOS: get_current_user() maneja en un solo lugar
    # la conversion int() segura Y el caso de usuario eliminado (devuelve 401, no 404).
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


# ── HELPER: parsear booleano de query string ──────────────────────────────────
def _parse_bool(value):
    """
    Convierte un query param string a bool o None.
    Acepta: "true", "1", "yes" → True
            "false", "0", "no" → False
            None, ""           → None (sin filtro aplicado)
    """
    if value is None or value == "":
        return None
    return value.lower() in ("true", "1", "yes")


# ── BUSCAR PERFILES COMPATIBLES ───────────────────────────────────────────────
@profile_bp.route("/search", methods=["GET"])
@jwt_required()
def search_profiles():
    current_user, err = get_current_user()
    if err:
        return err
    my_profile = current_user.profile

    # ── Leer parámetros de la URL ─────────────────────────────────────────────

    city = request.args.get("city", "Asunción")

    # BUG #1 CORREGIDO: antes usábamos int(...) directo, lo que lanza ValueError
    # si el frontend manda ?page=abc o un valor vacío accidentalmente.
    # Con type=int, Flask devuelve el default sin explotar.
    # El "or 1" y "or 20" cubren el caso de que llegue page=0 (inválido).
    # Beneficio para el usuario: nunca ve un error 500 por un param malformado.
    page = request.args.get("page", 1, type=int) or 1
    per_page = request.args.get("per_page", 20, type=int) or 20

    # BUG #2 CORREGIDO: limitamos per_page para evitar que alguien pida
    # ?per_page=9999 y sature la base de datos con una sola petición.
    # Beneficio: la API no puede ser abusada para hacer queries enormes.
    per_page = min(per_page, 100)

    min_age = request.args.get("min_age", type=int)
    max_age = request.args.get("max_age", type=int)
    pets_filter = _parse_bool(request.args.get("pets"))
    smoker_filter = _parse_bool(request.args.get("smoker"))

    # BUG #3 CORREGIDO: "or None" convierte string vacío "" a None.
    # Si el select de horario tiene value="" (Cualquiera), sin este fix
    # el backend intentaba filtrar Profile.schedule == "", devolviendo 0 resultados.
    # Beneficio: seleccionar "Cualquiera" en horario sí muestra todos los perfiles.
    schedule_filter = request.args.get("schedule") or None

    # BUG #4 CORREGIDO: antes float(...) sin try/except crasheaba si llegaba
    # ?min_score=abc. Ahora cae silenciosamente al default del 50%.
    # Beneficio: un parámetro inesperado no rompe toda la búsqueda.
    try:
        min_score = float(request.args.get("min_score", 50)) / 100.0
    except (ValueError, TypeError):
        min_score = 0.50

    # ── Construir query base ──────────────────────────────────────────────────
    query = Profile.query.join(User, User.id == Profile.user_id).filter(
        Profile.user_id != current_user.id,
        Profile.is_looking == True,
        User.status == "active",
        Profile.city == city,
    )

    # Filtros de edad del roomie buscado
    if min_age:
        query = query.filter(Profile.age >= min_age)
    if max_age:
        query = query.filter(Profile.age <= max_age)

    # Filtro de reciprocidad con manejo de NULL.
    # Si pref_min_age o pref_max_age es NULL en el candidato,
    # lo incluimos — NULL significa "acepta cualquier edad".
    # Sin el or_(...== None), SQL evalúa NULL <= 25 como NULL (falso)
    # y excluiría a casi todos los perfiles.
    if my_profile and my_profile.age:
        query = query.filter(
            or_(Profile.pref_min_age == None, Profile.pref_min_age <= my_profile.age)
        )
        query = query.filter(
            or_(Profile.pref_max_age == None, Profile.pref_max_age >= my_profile.age)
        )

    if pets_filter is not None:
        query = query.filter(Profile.pets == pets_filter)
    if smoker_filter is not None:
        query = query.filter(Profile.smoker == smoker_filter)
    if schedule_filter:
        query = query.filter(Profile.schedule == schedule_filter)

    all_profiles = query.all()

    # ── Calcular compatibilidad y aplicar umbral mínimo ───────────────────────
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

    # Paginar DESPUÉS de filtrar (correcto: pagina sobre los resultados reales)
    total = len(results)
    paged = results[(page - 1) * per_page : page * per_page]
    has_more = (page * per_page) < total

    return (
        jsonify(
            {
                "profiles": paged,
                "page": page,
                "total": total,
                "has_more": has_more,
            }
        ),
        200,
    )
