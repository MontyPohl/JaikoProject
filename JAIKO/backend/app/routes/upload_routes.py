import uuid
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import Profile, ListingPhoto, Listing, VerificationRequest
from ..utils.storage import upload_image

upload_bp = Blueprint("upload", __name__)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}


def _get_ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


# ── Foto de perfil ────────────────────────────────────────────────────────────
@upload_bp.route("/profile-photo", methods=["POST"])
@jwt_required()
def upload_profile_photo():
    user_id = int(get_jwt_identity())

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    ext = _get_ext(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Solo se permiten jpg/png/webp"}), 400

    filename = f"{user_id}_{uuid.uuid4().hex[:8]}.{ext}"

    try:
        url = upload_image(file.read(), filename, bucket="profiles")
    except Exception as e:
        return jsonify({"error": f"Upload fallido: {str(e)}"}), 500

    profile = Profile.query.filter_by(user_id=user_id).first()
    if profile:
        profile.profile_photo_url = url
        db.session.commit()

    return jsonify({"url": url}), 200


# ── Fotos de listing ──────────────────────────────────────────────────────────
@upload_bp.route("/listing/<int:listing_id>/photo", methods=["POST"])
@jwt_required()
def upload_listing_photo(listing_id):
    user_id = int(get_jwt_identity())
    listing = Listing.query.get_or_404(listing_id)

    if listing.owner_id != user_id:
        return jsonify({"error": "Forbidden"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    ext  = _get_ext(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Solo se permiten jpg/png/webp"}), 400

    filename = f"{listing_id}_{uuid.uuid4().hex[:8]}.{ext}"

    try:
        url = upload_image(file.read(), filename, bucket="listings")
    except Exception as e:
        return jsonify({"error": f"Upload fallido: {str(e)}"}), 500

    order = len(listing.photos)
    photo = ListingPhoto(listing_id=listing_id, photo_url=url, order=order)
    db.session.add(photo)
    db.session.commit()

    return jsonify({"photo": photo.to_dict()}), 201


# ── Foto de grupo ─────────────────────────────────────────────────────────────
@upload_bp.route("/group/<int:group_id>/photo", methods=["POST"])
@jwt_required()
def upload_group_photo(group_id):
    from ..models import Group
    user_id = int(get_jwt_identity())
    group   = Group.query.get_or_404(group_id)

    if group.owner_id != user_id:
        return jsonify({"error": "Forbidden"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    ext  = _get_ext(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Solo se permiten jpg/png/webp"}), 400

    filename = f"group_{group_id}_{uuid.uuid4().hex[:8]}.{ext}"

    try:
        url = upload_image(file.read(), filename, bucket="groups")
    except Exception as e:
        return jsonify({"error": f"Upload fallido: {str(e)}"}), 500

    group.photo_url = url
    db.session.commit()

    return jsonify({"url": url}), 200


# ── Selfie de verificación (bucket PRIVADO) ───────────────────────────────────
@upload_bp.route("/verification-selfie", methods=["POST"])
@jwt_required()
def upload_verification_selfie():
    user_id = int(get_jwt_identity())

    vr = VerificationRequest.query.filter_by(user_id=user_id).first()
    if not vr:
        return jsonify({"error": "Solicitá la verificación primero"}), 404

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    ext  = _get_ext(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Solo se permiten jpg/png/webp"}), 400

    # Path descriptivo: verify_{user_id}_{uuid}.ext
    filename = f"verify_{user_id}_{uuid.uuid4().hex[:8]}.{ext}"

    try:
        # Sube al bucket PRIVADO — devuelve el path, no URL pública
        path = upload_image(file.read(), filename, bucket="verifications")
    except Exception as e:
        return jsonify({"error": f"Upload fallido: {str(e)}"}), 500

    # Guardamos el PATH (no URL pública) en selfie_url
    vr.selfie_url = path
    vr.status = "pending_verification"
    db.session.commit()

    return jsonify({"message": "Selfie subida correctamente"}), 200