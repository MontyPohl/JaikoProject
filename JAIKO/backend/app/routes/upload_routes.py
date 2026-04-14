import uuid
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import Profile, ListingPhoto, Listing, VerificationRequest, Group
from ..utils.storage import upload_image
from ..utils.jwt_helpers import get_current_user_id

upload_bp = Blueprint("upload", __name__)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}

# Límite de 5 MB expresado en bytes.
# Es más que suficiente para una foto de perfil o departamento de buena calidad.
# Imágenes más grandes casi siempre son fotos sin comprimir que el frontend
# debería redimensionar antes de subir.
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def _get_ext(filename: str) -> str:
    """Extrae la extensión del nombre de archivo en minúsculas."""
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _validate_file(file) -> tuple[bool, str]:
    """
    Valida extensión y tamaño de un archivo subido.

    Por qué existe esta función:
    Los 4 endpoints de upload necesitan las mismas dos validaciones.
    Centralizar la lógica aquí significa que si mañana cambia el límite
    de tamaño o las extensiones permitidas, se edita en un solo lugar.

    Por qué usamos seek/tell en lugar de len(file.read()):
    file.read() cargaría el archivo completo en memoria solo para contar bytes.
    seek(0, 2) mueve el cursor al final y tell() devuelve esa posición (= tamaño),
    sin leer nada. Después seek(0) resetea el cursor para el read() posterior.

    Returns:
        (True, "")          si el archivo es válido
        (False, "mensaje")  si hay algún problema
    """
    ext = _get_ext(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        return False, "Solo se permiten jpg/png/webp"

    file.seek(0, 2)
    size = file.tell()
    file.seek(0)

    if size > MAX_FILE_SIZE:
        mb = MAX_FILE_SIZE // (1024 * 1024)
        return False, f"El archivo supera el límite de {mb} MB"

    return True, ""


# ── Foto de perfil ────────────────────────────────────────────────────────────
@upload_bp.route("/profile-photo", methods=["POST"])
@jwt_required()
def upload_profile_photo():
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    ok, error = _validate_file(file)
    if not ok:
        return jsonify({"error": error}), 400

    ext = _get_ext(file.filename)
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
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    listing = Listing.query.get_or_404(listing_id)
    if listing.owner_id != user_id:
        return jsonify({"error": "Forbidden"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    ok, error = _validate_file(file)
    if not ok:
        return jsonify({"error": error}), 400

    ext = _get_ext(file.filename)
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
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    group = Group.query.get_or_404(group_id)

    # Verificamos contra created_by (no owner_id — ese campo no existe en Group)
    if group.created_by != user_id:
        return jsonify({"error": "Forbidden"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    ok, error = _validate_file(file)
    if not ok:
        return jsonify({"error": error}), 400

    ext = _get_ext(file.filename)
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
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    vr = VerificationRequest.query.filter_by(user_id=user_id).first()
    if not vr:
        return jsonify({"error": "Solicitá la verificación primero"}), 404

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    ok, error = _validate_file(file)
    if not ok:
        return jsonify({"error": error}), 400

    ext = _get_ext(file.filename)
    filename = f"verify_{user_id}_{uuid.uuid4().hex[:8]}.{ext}"

    try:
        # Sube al bucket PRIVADO — devuelve el path, no URL pública.
        # La URL firmada temporal se genera en verification_routes.py cuando
        # el admin necesita ver la selfie.
        path = upload_image(file.read(), filename, bucket="verifications")
    except Exception as e:
        return jsonify({"error": f"Upload fallido: {str(e)}"}), 500

    vr.selfie_url = path
    vr.status = "pending_verification"
    db.session.commit()

    return jsonify({"message": "Selfie subida correctamente"}), 200
