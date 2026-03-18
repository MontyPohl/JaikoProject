from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, Profile, RoommateRequest
from ..services.matching_service import compute_compatibility
from typing import cast, List

profile_bp = Blueprint("profiles", __name__)
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
    allowed = [
        "name", "age", "gender", "profession", "bio",
        "budget_min", "budget_max", "pets", "smoker",
        "schedule", "diseases", "city", "is_looking",
    ]
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
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get_or_404(current_user_id)
    my_profile = current_user.profile

    city = request.args.get("city", "Asunción")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))

    query = (
        Profile.query
        .join(User)
        .filter(
            Profile.user_id != current_user_id,
            Profile.is_looking == True,
            User.status == "active",
            Profile.city == city,
        )
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
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


# ── SOLICITUDES ─────────────────────────────────────────────
@requests_bp.route("/", methods=["POST"])
@jwt_required()
def create_request():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    target_user_id = data.get("target_user_id")
    if not target_user_id:
        return jsonify({"error": "target_user_id requerido"}), 400

    req = RoommateRequest(
        sender_user_id=user_id,
        target_user_id=target_user_id,
        type=data.get("type", "roommate"),
        status="pending"
    )
    db.session.add(req)
    db.session.commit()
    return jsonify({"request_id": req.id}), 201


@requests_bp.route("/<int:req_id>/respond", methods=["PUT"])
@jwt_required()
def respond_request(req_id):
    user_id = int(get_jwt_identity())
    data = request.get_json()
    action = data.get("action")
    if action not in ["accept", "reject"]:
        return jsonify({"error": "Action inválida"}), 400

    req = RoommateRequest.query.get_or_404(req_id)
    if req.target_user_id != user_id:
        return jsonify({"error": "No autorizado"}), 403

    sender = req.sender_user
    receiver = req.target_user

    # Validar que ambos tengan perfil
    if not sender.profile or not receiver.profile:
        return jsonify({"error": "Uno de los usuarios no tiene perfil"}), 400

    if action == "accept":
        # Marcar solicitud como aceptada
        req.status = "accepted"

        # Guardar relación de roomies directamente
        sender.profile.current_roomie_id = receiver.id
        receiver.profile.current_roomie_id = sender.id

        # Cambiar estado de búsqueda
        sender.profile.is_looking = False
        receiver.profile.is_looking = False

        db.session.commit()

        return jsonify({
            "message": "Solicitud aceptada",
            "roommate": {
                "id": receiver.id,
                "name": receiver.profile.name,
                "profile_photo_url": receiver.profile.profile_photo_url
            }
        }), 200
    else:
        req.status = "rejected"
        db.session.commit()
        return jsonify({
            "message": "Solicitud rechazada",
            "redirect": "/notifications"
        }), 200