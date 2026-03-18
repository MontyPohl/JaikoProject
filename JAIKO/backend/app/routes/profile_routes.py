from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, Profile, RoommateRequest
from ..services.matching_service import compute_compatibility
from typing import cast, List

profile_bp = Blueprint("profiles", __name__)
# Blueprint para gestionar las solicitudes de rumi
requests_bp = Blueprint("requests", __name__)

# ── PERFIL ───────────────────────────────────────────────

@profile_bp.route("/me", methods=["PUT"])
@jwt_required()
def update_my_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    profile = user.profile
    if not profile:
        profile = Profile(user_id=user_id)
        db.session.add(profile)

    data = request.get_json()
    
    # --- Cambios realizados por Aaron Barrios ---
    # Agrego las preferencias de edad a los campos permitidos para guardar en el perfil
    allowed = [
        "name", "age", "gender", "profession", "bio",
        "budget_min", "budget_max", "pets", "smoker",
        "schedule", "diseases", "city", "is_looking",
        "pref_min_age", "pref_max_age", # Columnas para la reciprocidad
    ]
    # --------------------------------------------
    
    for field in allowed:
        if field in data:
            setattr(profile, field, data[field])

    db.session.commit()
    return jsonify({"profile": profile.to_dict(include_private=True)}), 200


@profile_bp.route("/<int:user_id>", methods=["GET"])
@jwt_required()
def get_profile(user_id):
    user = User.query.get_or_404(user_id)
    if user.is_blocked():
        return jsonify({"error": "User not available"}), 404
    return jsonify({"profile": user.profile.to_dict() if user.profile else None}), 200


@profile_bp.route("/search", methods=["GET"])
@jwt_required()
def search_profiles():
    """Return profiles with >= 80% compatibility and reciprocal age filtering."""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get_or_404(current_user_id)
    my_profile = current_user.profile

    city = request.args.get("city", "Asunción")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))

    # --- Cambios realizados por Aaron Barrios ---
    # Capturo los parámetros de edad enviados desde SearchPage.jsx
    min_age = request.args.get("min_age", type=int)
    max_age = request.args.get("max_age", type=int)
    # --------------------------------------------

    # Definimos la base de la consulta
    query = (
        Profile.query
        .join(User)
        .filter(
            Profile.user_id != current_user_id,
            Profile.is_looking == True,
            User.status == "active",
            Profile.city == city,
        )
    )

    # --- Cambios realizados por Aaron Barrios ---
    # 1. Filtro de Salida: El roomie debe estar en el rango que YO busco
    if min_age:
        query = query.filter(Profile.age >= min_age)
    if max_age:
        query = query.filter(Profile.age <= max_age)

    # 2. Filtro de Entrada (Reciprocidad): 
    # Solo me salen personas que aceptarían mi edad actual (31 años)
    if my_profile and my_profile.age:
        query = query.filter(
            Profile.pref_min_age <= my_profile.age,
            Profile.pref_max_age >= my_profile.age
        )
    # --------------------------------------------

    # Aplicamos paginación al final de todos los filtros
    query = query.offset((page - 1) * per_page).limit(per_page)
    profiles = query.all()

    results = []
    for p in profiles:
        score, matches, mismatches = compute_compatibility(my_profile, p)
        if score >= 0.80:
            d = p.to_dict()
            d["compatibility"] = round(score * 100)
            d["matches"] = matches
            d["mismatches"] = mismatches
            results.append(d)

    results.sort(key=lambda x: x["compatibility"], reverse=True)
    return jsonify({"profiles": results, "page": page}), 200
