from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from functools import wraps
from ..extensions import db
from ..models import User, Report, Notification, Listing, Group
from ..utils.jwt_helpers import get_current_user, get_current_user_id

admin_bp = Blueprint("admin", __name__)


def admin_required(fn):
    """
    Decorador que verifica que el usuario autenticado tenga rol 'admin'.

    BUG CORREGIDO: antes usaba int(get_jwt_identity()) + get_or_404.
    Problema: si el sub del token no era un número, crasheaba con ValueError.
    Si el admin fue eliminado de la BD, devolvía 404 en lugar de 401.
    Ahora get_current_user() maneja ambos casos de forma segura.
    """

    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user, err = get_current_user()
        if err:
            return err
        if user.role not in ("admin",):
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)

    return wrapper


@admin_bp.route("/reports", methods=["GET"])
@admin_required
def get_reports():
    status = request.args.get("status", "open")

    # BUG CORREGIDO: int(...) directo crashea si page/per_page no son números.
    # type=int hace que Flask devuelva el default en vez de lanzar ValueError.
    page = request.args.get("page", 1, type=int) or 1
    per_page = request.args.get("per_page", 20, type=int) or 20

    q = Report.query.filter_by(status=status).order_by(Report.created_at.desc())
    total = q.count()
    reports = q.offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({"reports": [r.to_dict() for r in reports], "total": total}), 200


@admin_bp.route("/reports/<int:report_id>", methods=["PUT"])
@admin_required
def handle_report(report_id):
    # BUG CORREGIDO: admin_id = int(get_jwt_identity()) → get_current_user_id()
    # Como admin_required ya validó que el usuario existe y es admin,
    # get_current_user_id() es suficiente aquí (solo necesitamos el id numérico).
    admin_id = get_current_user_id()
    report = Report.query.get_or_404(report_id)
    data = request.get_json()

    report.status = data.get("status", report.status)
    report.admin_note = data.get("admin_note", report.admin_note)
    report.reviewed_by = admin_id

    action = data.get("action")  # block | warn | dismiss
    if action == "block" and report.reported_user_id:
        user = User.query.get(report.reported_user_id)
        if user:
            user.status = "blocked"
            db.session.add(
                Notification(
                    user_id=user.id,
                    type="system",
                    title="Cuenta bloqueada",
                    content="Tu cuenta ha sido bloqueada por violar los términos de servicio.",
                )
            )
    elif action == "warn" and report.reported_user_id:
        user = User.query.get(report.reported_user_id)
        if user:
            user.status = "warned"
            db.session.add(
                Notification(
                    user_id=user.id,
                    type="system",
                    title="Advertencia",
                    content=f"Recibiste una advertencia: {data.get('admin_note', '')}",
                )
            )

    db.session.commit()
    return jsonify({"report": report.to_dict()}), 200


@admin_bp.route("/users", methods=["GET"])
@admin_required
def get_users():
    # BUG CORREGIDO: mismo fix de type=int para page y per_page
    page = request.args.get("page", 1, type=int) or 1
    per_page = request.args.get("per_page", 30, type=int) or 30
    status = request.args.get("status")

    q = User.query
    if status:
        q = q.filter_by(status=status)

    total = q.count()
    users = (
        q.order_by(User.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return jsonify({"users": [u.to_dict() for u in users], "total": total}), 200


@admin_bp.route("/users/<int:user_id>/status", methods=["PUT"])
@admin_required
def update_user_status(user_id):
    data = request.get_json()
    user = User.query.get_or_404(user_id)

    allowed_statuses = ["active", "blocked", "warned"]
    if data.get("status") not in allowed_statuses:
        return jsonify({"error": f"status must be one of {allowed_statuses}"}), 400

    user.status = data["status"]
    db.session.commit()
    return jsonify({"user": user.to_dict()}), 200


@admin_bp.route("/stats", methods=["GET"])
@admin_required
def get_stats():
    total_income = db.session.query(
        db.func.coalesce(db.func.sum(Listing.total_price), 0)
    ).scalar()

    return (
        jsonify(
            {
                "users": {
                    "total": User.query.count(),
                    "active": User.query.filter_by(status="active").count(),
                    "blocked": User.query.filter_by(status="blocked").count(),
                },
                "listings": {
                    "total": Listing.query.count(),
                    "active": Listing.query.filter_by(status="active").count(),
                    "total_income": total_income,
                },
                "groups": {
                    "total": Group.query.count(),
                    "open": Group.query.filter_by(status="open").count(),
                },
                "reports": {
                    "open": Report.query.filter_by(status="open").count(),
                    "reviewed": Report.query.filter(
                        Report.status == "reviewed"
                    ).count(),
                    "total": Report.query.count(),
                },
            }
        ),
        200,
    )
