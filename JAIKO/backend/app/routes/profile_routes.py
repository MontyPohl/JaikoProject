"""
app/routes/profile_routes.py
─────────────────────────────
Cambios en esta versión:
    GET /<user_id> ahora devuelve dos campos extra:
      - pending_request_id: ID de solicitud pendiente de ese usuario al actual
      - was_roomie: bool — si alguna vez tuvieron una solicitud aceptada
    Esto permite al frontend mostrar correctamente el banner de solicitud
    y el formulario de reseña, incluso después de dejar de ser roomies.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import or_, and_
from ..extensions import db
from ..models import User, Profile, RoommateRequest
from ..services.matching_service import compute_compatibility
from ..utils.jwt_helpers import get_current_user, get_current_user_id
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
        "name", "age", "gender", "profession", "bio",
        "budget_min", "budget_max", "pets", "smoker", "schedule",
        "diseases", "city", "is_looking", "lat", "lng",
        "pref_min_age", "pref_max_age", "profile_photo_url",
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
    current_user_id = get_current_user_id()

    target_user = User.query.get_or_404(user_id)
    if target_user.is_blocked():
        return jsonify({"error": "Usuario no disponible"}), 404

    profile_data = target_user.profile.to_dict() if target_user.profile else None

    pending_request_id = None
    was_roomie         = False

    # Solo calculamos estos valores cuando se visita el perfil de OTRO usuario
    if current_user_id and current_user_id != user_id:

        # ── Solicitud pendiente de target → current ───────────────────────────
        # Si target le mandó una solicitud al usuario actual y aún está pendiente,
        # el frontend muestra el banner de Aceptar / Rechazar.
        pending_req = RoommateRequest.query.filter_by(
            sender_user_id=user_id,
            target_user_id=current_user_id,
            status="pending",
        ).first()
        if pending_req:
            pending_request_id = pending_req.id

        # ── Historial de roomies ──────────────────────────────────────────────
        # Si alguna vez hubo una solicitud ACEPTADA entre los dos (en cualquier
        # dirección), were_roomies = True. Esto persiste aunque dejen de serlo,
        # y permite que puedan dejarse reseñas mutuamente.
        was_roomie = RoommateRequest.query.filter(
            or_(
                and_(
                    RoommateRequest.sender_user_id == current_user_id,
                    RoommateRequest.target_user_id == user_id,
                ),
                and_(
                    RoommateRequest.sender_user_id == user_id,
                    RoommateRequest.target_user_id == current_user_id,
                ),
            ),
            RoommateRequest.status == "accepted",
        ).first() is not None

    return jsonify({
        "profile":            profile_data,
        "pending_request_id": pending_request_id,
        "was_roomie":         was_roomie,
    }), 200


# ── BUSCAR PERFILES COMPATIBLES ───────────────────────────────────────────────
@profile_bp.route("/search", methods=["GET"])
@jwt_required()
def search_profiles():
    current_user, err = get_current_user()
    if err:
        return err
    my_profile = current_user.profile

    city     = request.args.get("city",     "Asunción")
    page     = request.args.get("page",     1,  type=int) or 1
    per_page = request.args.get("per_page", 20, type=int) or 20

    query = (
        Profile.query
        .join(User, User.id == Profile.user_id)
        .filter(
            Profile.user_id  != current_user.id,
            Profile.city     == city,
            Profile.is_looking == True,
            User.status      == "active",
        )
    )

    gender = request.args.get("gender")
    if gender:
        query = query.filter(Profile.gender == gender)

    pets    = request.args.get("pets")
    smoker  = request.args.get("smoker")
    if pets   is not None: query = query.filter(Profile.pets   == parse_bool(pets))
    if smoker is not None: query = query.filter(Profile.smoker == parse_bool(smoker))

    schedule = request.args.get("schedule")
    if schedule:
        query = query.filter(Profile.schedule == schedule)

    budget_max = request.args.get("budget_max", type=int)
    if budget_max:
        query = query.filter(
            or_(Profile.budget_max == None, Profile.budget_max <= budget_max)
        )

    total    = query.count()
    profiles = query.offset((page - 1) * per_page).limit(per_page).all()

    results = []
    for p in profiles:
        d = p.to_dict()
        if my_profile:
            score, matches, mismatches = compute_compatibility(my_profile, p)
            d["compatibility"] = score
            d["matches"]       = matches
            d["mismatches"]    = mismatches
        results.append(d)

    results.sort(key=lambda x: x.get("compatibility", 0), reverse=True)

    return jsonify({
        "profiles": results,
        "total":    total,
        "page":     page,
    }), 200
