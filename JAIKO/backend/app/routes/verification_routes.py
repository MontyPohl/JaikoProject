import random
import string
from functools import wraps
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import VerificationRequest, User, Profile
from ..utils.storage import get_signed_url
from ..utils.jwt_helpers import get_current_user, get_current_user_id

verification_bp = Blueprint("verification", __name__)


def verifier_required(fn):
    """
    Decorador que verifica que el usuario autenticado tenga rol 'admin' o 'verifier'.

    BUG CORREGIDO: antes usaba int(get_jwt_identity()) + get_or_404.
    Mismo problema que admin_required: crash con ValueError si el sub del token
    no es un entero, y 404 en lugar de 401 si el usuario fue eliminado.
    Ahora usa get_current_user() que maneja ambos casos de forma segura.
    """

    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user, err = get_current_user()
        if err:
            return err
        if user.role not in ("admin", "verifier"):
            return jsonify({"error": "Verifier access required"}), 403
        return fn(*args, **kwargs)

    return wrapper


def _generate_code() -> str:
    return "JAIKO-" + "".join(random.choices(string.digits, k=4))


# ── Usuario: solicitar verificación ──────────────────────────────────────────
@verification_bp.route("/request", methods=["POST"])
@jwt_required()
def request_verification():
    # BUG CORREGIDO: int(get_jwt_identity()) + get_or_404 → get_current_user()
    # Aquí necesitamos el objeto User completo (para acceder a user.profile),
    # así que usamos get_current_user() en lugar de get_current_user_id().
    user, err = get_current_user()
    if err:
        return err

    existing = VerificationRequest.query.filter_by(user_id=user.id).first()
    if existing:
        if existing.status == "verified":
            return jsonify({"error": "Already verified"}), 400
        existing.verification_code = _generate_code()
        existing.status = "pending_verification"
        existing.selfie_url = None
        existing.rejection_reason = None
        db.session.commit()
        return jsonify({"verification": existing.to_dict()}), 200

    code = _generate_code()
    vr = VerificationRequest(user_id=user.id, verification_code=code)
    db.session.add(vr)

    if user.profile:
        user.profile.verification_status = "pending_verification"

    db.session.commit()
    return jsonify({"verification": vr.to_dict()}), 201


# ── Usuario: ver su estado de verificación ───────────────────────────────────
@verification_bp.route("/me", methods=["GET"])
@jwt_required()
def get_my_verification():
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    # Solo necesitamos el id para filtrar — no hace falta traer el User completo.
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    vr = VerificationRequest.query.filter_by(user_id=user_id).first()
    return jsonify({"verification": vr.to_dict() if vr else None}), 200


# ── Admin/Verifier: listar pendientes ────────────────────────────────────────
@verification_bp.route("/pending", methods=["GET"])
@verifier_required
def get_pending():
    pending = VerificationRequest.query.filter_by(status="pending_verification").all()
    result = []
    for v in pending:
        d = v.to_dict()
        if v.user and v.user.profile:
            d["profile_photo_url"] = v.user.profile.profile_photo_url
            d["user_name"] = v.user.profile.name
        result.append(d)
    return jsonify({"pending": result, "total": len(result)}), 200


# ── Admin/Verifier: obtener URL firmada de la selfie ─────────────────────────
@verification_bp.route("/<int:vr_id>/selfie-url", methods=["GET"])
@verifier_required
def get_selfie_signed_url(vr_id):
    """
    Genera una URL firmada temporal (1 hora) para que el admin
    pueda ver la selfie almacenada en el bucket privado.
    """
    vr = VerificationRequest.query.get_or_404(vr_id)

    if not vr.selfie_url:
        return jsonify({"error": "Este usuario no subió selfie todavía"}), 404

    try:
        signed_url = get_signed_url(
            bucket="verifications",
            path=vr.selfie_url,  # selfie_url guarda el path, no la URL pública
            expires_in=3600,  # expira en 1 hora
        )
    except Exception as e:
        return jsonify({"error": f"No se pudo generar la URL: {str(e)}"}), 500

    return jsonify({"signed_url": signed_url}), 200


# ── Admin/Verifier: aprobar o rechazar ───────────────────────────────────────
@verification_bp.route("/<int:vr_id>/review", methods=["PUT"])
@verifier_required
def review_verification(vr_id):
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    # verifier_required ya validó que el usuario existe y tiene rol correcto,
    # así que get_current_user_id() es suficiente — solo necesitamos el id.
    reviewer_id = get_current_user_id()

    vr = VerificationRequest.query.get_or_404(vr_id)
    data = request.get_json()

    action = data.get("action")  # approve | reject
    if action not in ("approve", "reject"):
        return jsonify({"error": "action must be approve or reject"}), 400

    vr.reviewed_by = reviewer_id
    user = User.query.get(vr.user_id)

    if action == "approve":
        vr.status = "verified"
        if user and user.profile:
            user.profile.verified = True
            user.profile.verification_status = "verified"
    else:
        vr.status = "rejected"
        vr.rejection_reason = data.get("reason", "No cumple los requisitos")
        if user and user.profile:
            user.profile.verification_status = "rejected"

    db.session.commit()
    return jsonify({"verification": vr.to_dict()}), 200
