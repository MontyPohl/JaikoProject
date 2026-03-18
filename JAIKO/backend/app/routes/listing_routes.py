from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import Listing, ListingPhoto, User

listing_bp = Blueprint("listings", __name__)

# ── GET /listings ───────────────────────────────────────────────────────────
@listing_bp.route("/", methods=["GET"])
def get_listings():
    city     = request.args.get("city", "Asunción")
    page     = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    min_price = request.args.get("min_price", type=int)
    max_price = request.args.get("max_price", type=int)
    pets    = request.args.get("pets_allowed")
    smoking = request.args.get("smoking_allowed")
    # FIX: type es un filtro OPCIONAL que puede venir del frontend.
    # Antes estaba hardcodeado a "apartment", lo que ocultaba todos los
    # listings de tipo "room" o "house" sin importar lo que el usuario creara.
    listing_type = request.args.get("type")

    q = Listing.query.filter(
        Listing.city == city,
        Listing.status == "active",
    )

    # Solo filtrar por type si el frontend lo pide explícitamente
    if listing_type:
        q = q.filter(Listing.type == listing_type)

    if min_price:
        q = q.filter(Listing.total_price >= min_price)
    if max_price:
        q = q.filter(Listing.total_price <= max_price)

    if pets == "true":
        q = q.filter(Listing.pets_allowed == True)
    elif pets == "false":
        q = q.filter(Listing.pets_allowed == False)

    if smoking == "true":
        q = q.filter(Listing.smoking_allowed == True)
    elif smoking == "false":
        q = q.filter(Listing.smoking_allowed == False)

    total    = q.count()
    listings = q.order_by(Listing.created_at.desc()) \
                .offset((page - 1) * per_page) \
                .limit(per_page) \
                .all()

    return jsonify({
        "listings": [l.to_dict() for l in listings],
        "total": total,
        "page": page,
        "pages": (total + per_page - 1) // per_page,
    }), 200


# ── GET /listings/<id> ──────────────────────────────────────────────────────
@listing_bp.route("/<int:listing_id>", methods=["GET"])
def get_listing(listing_id):
    listing = Listing.query.get_or_404(listing_id)
    data = listing.to_dict()
    owner_profile = listing.owner.profile
    data["owner"] = owner_profile.to_dict() if owner_profile else None
    return jsonify({"listing": data}), 200


# ── POST /listings ──────────────────────────────────────────────────────────
@listing_bp.route("/", methods=["POST"])
@jwt_required()
def create_listing():
    user_id = int(get_jwt_identity())
    data = request.get_json()

    required = ["title", "city", "total_price", "rooms", "max_people"]
    for f in required:
        if f not in data:
            return jsonify({"error": f"{f} is required"}), 400

    listing = Listing(
        owner_id=user_id,
        title=data["title"],
        description=data.get("description"),
        city=data["city"],
        neighborhood=data.get("neighborhood"),
        address=data.get("address"),
        latitude=data.get("latitude"),
        longitude=data.get("longitude"),
        total_price=data["total_price"],
        rooms=data["rooms"],
        bathrooms=data.get("bathrooms", 1),
        max_people=data["max_people"],
        pets_allowed=data.get("pets_allowed", False),
        smoking_allowed=data.get("smoking_allowed", False),
        furnished=data.get("furnished", False),
        type=data.get("type", "apartment"),
        # FIX: setear status="active" explícitamente al crear.
        # Si el modelo no tiene default o tiene default distinto, el listing
        # quedaba con status NULL y el filtro .status=="active" lo excluía.
        status="active",
    )
    db.session.add(listing)
    db.session.commit()
    return jsonify({"listing": listing.to_dict()}), 201


# ── PUT /listings/<id> ──────────────────────────────────────────────────────
@listing_bp.route("/<int:listing_id>", methods=["PUT"])
@jwt_required()
def update_listing(listing_id):
    user_id = int(get_jwt_identity())
    listing = Listing.query.get_or_404(listing_id)
    if listing.owner_id != user_id:
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json()
    updatable = [
        "title", "description", "city", "neighborhood", "address",
        "latitude", "longitude", "total_price", "rooms", "bathrooms",
        "max_people", "pets_allowed", "smoking_allowed", "furnished",
        "type", "status",
    ]
    for f in updatable:
        if f in data:
            setattr(listing, f, data[f])

    db.session.commit()
    return jsonify({"listing": listing.to_dict()}), 200


# ── DELETE /listings/<id> ───────────────────────────────────────────────────
@listing_bp.route("/<int:listing_id>", methods=["DELETE"])
@jwt_required()
def delete_listing(listing_id):
    user_id = int(get_jwt_identity())
    listing = Listing.query.get_or_404(listing_id)
    if listing.owner_id != user_id:
        return jsonify({"error": "Forbidden"}), 403
    listing.status = "deleted"
    db.session.commit()
    return jsonify({"message": "Listing deleted"}), 200


# ── GET /listings/my ────────────────────────────────────────────────────────
@listing_bp.route("/my", methods=["GET"])
@jwt_required()
def my_listings():
    user_id = int(get_jwt_identity())
    listings = Listing.query.filter_by(owner_id=user_id) \
                            .order_by(Listing.created_at.desc()) \
                            .all()
    return jsonify({"listings": [l.to_dict() for l in listings]}), 200