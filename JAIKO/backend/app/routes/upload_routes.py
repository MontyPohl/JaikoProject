import uuid
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import Profile, ListingPhoto, Listing, VerificationRequest, Group
from ..utils.storage import upload_image

upload_bp = Blueprint("upload", __name__)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}

# Límite de 5 MB expresado en bytes.
# Por qué 5 MB: es más que suficiente para una foto de perfil o departamento
# de buena calidad. Imágenes más grandes casi siempre son fotos sin comprimir
# que el frontend debería redimensionar antes de subir.
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
    file.read() cargaría el archivo completo en memoria solo para contar bytes,
    que es exactamente el problema que queremos prevenir. seek(0, 2) mueve
    el cursor al final del archivo y tell() devuelve esa posición (= tamaño),
    sin leer nada. Después seek(0) resetea el cursor para que el read()
    posterior funcione correctamente.

    Returns:
        (True, "")            si el archivo es válido
        (False, "mensaje")    si hay algún problema
    """
    ext = _get_ext(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        return False, "Solo se permiten jpg/png/webp"

    # Medimos el tamaño sin leer el contenido
    file.seek(0, 2)  # mover cursor al final
    size = file.tell()  # leer la posición = tamaño en bytes
    file.seek(0)  # resetear cursor al inicio

    if size > MAX_FILE_SIZE:
        mb = MAX_FILE_SIZE // (1024 * 1024)
        return False, f"El archivo supera el límite de {mb} MB"

    return True, ""


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
    user_id = int(get_jwt_identity())
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
# BUG #5 CORREGIDO: se usaba group.owner_id pero el modelo Group no tiene ese
# campo. El campo correcto es group.created_by (definido en models/group.py).
# También se movió el import de Group al bloque de imports del archivo (arriba),
# en lugar de tenerlo dentro de la función — es más limpio y es la convención.
@upload_bp.route("/group/<int:group_id>/photo", methods=["POST"])
@jwt_required()
def upload_group_photo(group_id):
    user_id = int(get_jwt_identity())
    group = Group.query.get_or_404(group_id)

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
    user_id = int(get_jwt_identity())

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
        # Sube al bucket PRIVADO — devuelve el path, no URL pública
        path = upload_image(file.read(), filename, bucket="verifications")
    except Exception as e:
        return jsonify({"error": f"Upload fallido: {str(e)}"}), 500

    # Guardamos el PATH (no URL pública) en selfie_url
    vr.selfie_url = path
    vr.status = "pending_verification"
    db.session.commit()

    return jsonify({"message": "Selfie subida correctamente"}), 200
