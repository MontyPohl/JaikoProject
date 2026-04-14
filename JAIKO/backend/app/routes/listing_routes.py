from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import Listing, ListingPhoto, User
from ..utils.jwt_helpers import get_current_user_id

listing_bp = Blueprint("listings", __name__)


# ── GET /listings ────────────────────────────────────────────────────────────
@listing_bp.route("/", methods=["GET"])
def get_listings():
    city = request.args.get("city", "Asunción")
    min_price = request.args.get("min_price", type=int)
    max_price = request.args.get("max_price", type=int)
    pets = request.args.get("pets_allowed")
    smoking = request.args.get("smoking_allowed")
    listing_type = request.args.get("type")

    # BUG CORREGIDO: int(request.args.get(...)) → type=int
    # Si page o per_page no son números, Flask devuelve el default en lugar de crashear.
    page = request.args.get("page", 1, type=int) or 1
    per_page = request.args.get("per_page", 20, type=int) or 20

    q = Listing.query.filter(
        Listing.city == city,
        Listing.status == "active",
    )

    # Solo filtrar por type si el frontend lo pide explícitamente.
    # Antes estaba hardcodeado a "apartment", ocultando listings de tipo
    # "room" o "house" sin importar lo que el usuario hubiera creado.
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

    total = q.count()
    listings = (
        q.order_by(Listing.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return (
        jsonify(
            {
                "listings": [l.to_dict() for l in listings],
                "total": total,
                "page": page,
                "pages": (total + per_page - 1) // per_page,
            }
        ),
        200,
    )


# ── GET /listings/<id> ───────────────────────────────────────────────────────
@listing_bp.route("/<int:listing_id>", methods=["GET"])
def get_listing(listing_id):
    # Este endpoint es público — no usa JWT, así que get_or_404 es correcto acá.
    listing = Listing.query.get_or_404(listing_id)
    data = listing.to_dict()
    owner_profile = listing.owner.profile
    data["owner"] = owner_profile.to_dict() if owner_profile else None
    return jsonify({"listing": data}), 200


# ── POST /listings ───────────────────────────────────────────────────────────
@listing_bp.route("/", methods=["POST"])
@jwt_required()
def create_listing():
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

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
        # Seteamos status="active" explícitamente al crear.
        # Sin esto, si el modelo no tiene default, el listing queda con
        # status=NULL y el filtro .status=="active" lo excluye de los resultados.
        status="active",
    )
    db.session.add(listing)
    db.session.commit()
    return jsonify({"listing": listing.to_dict()}), 201


# ── PUT /listings/<id> ───────────────────────────────────────────────────────
@listing_bp.route("/<int:listing_id>", methods=["PUT"])
@jwt_required()
def update_listing(listing_id):
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    listing = Listing.query.get_or_404(listing_id)
    if listing.owner_id != user_id:
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json()
    updatable = [
        "title",
        "description",
        "city",
        "neighborhood",
        "address",
        "latitude",
        "longitude",
        "total_price",
        "rooms",
        "bathrooms",
        "max_people",
        "pets_allowed",
        "smoking_allowed",
        "furnished",
        "type",
        "status",
    ]
    for f in updatable:
        if f in data:
            setattr(listing, f, data[f])

    db.session.commit()
    return jsonify({"listing": listing.to_dict()}), 200


# ── DELETE /listings/<id> ────────────────────────────────────────────────────
@listing_bp.route("/<int:listing_id>", methods=["DELETE"])
@jwt_required()
def delete_listing(listing_id):
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    listing = Listing.query.get_or_404(listing_id)
    if listing.owner_id != user_id:
        return jsonify({"error": "Forbidden"}), 403

    # Borrado lógico: marcamos como "deleted" en lugar de eliminar de la BD.
    # Beneficio: podemos recuperar el registro si fue un error, y los chats
    # o referencias a este listing no quedan con FK inválidas.
    listing.status = "deleted"
    db.session.commit()
    return jsonify({"message": "Listing deleted"}), 200


# ── GET /listings/my ─────────────────────────────────────────────────────────
@listing_bp.route("/my", methods=["GET"])
@jwt_required()
def my_listings():
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    listings = (
        Listing.query.filter_by(owner_id=user_id)
        .order_by(Listing.created_at.desc())
        .all()
    )
    return jsonify({"listings": [l.to_dict() for l in listings]}), 200
