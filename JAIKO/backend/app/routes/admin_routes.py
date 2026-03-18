from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
from ..extensions import db
from ..models import User, Report, Notification, Listing, Group

admin_bp = Blueprint("admin", __name__)

def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = int(get_jwt_identity())
        user = User.query.get_or_404(user_id)
        if user.role not in ("admin",):
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)
    return wrapper


@admin_bp.route("/reports", methods=["GET"])
@admin_required
def get_reports():
    status = request.args.get("status", "open")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    q = Report.query.filter_by(status=status).order_by(Report.created_at.desc())
    total = q.count()
    reports = q.offset((page - 1) * per_page).limit(per_page).all()
    return jsonify({"reports": [r.to_dict() for r in reports], "total": total}), 200


@admin_bp.route("/reports/<int:report_id>", methods=["PUT"])
@admin_required
def handle_report(report_id):
    admin_id = int(get_jwt_identity())
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
            db.session.add(Notification(
                user_id=user.id,
                type="system",
                title="Cuenta bloqueada",
                content="Tu cuenta ha sido bloqueada por violar los términos de servicio.",
            ))
    elif action == "warn" and report.reported_user_id:
        user = User.query.get(report.reported_user_id)
        if user:
            user.status = "warned"
            db.session.add(Notification(
                user_id=user.id,
                type="system",
                title="Advertencia",
                content=f"Recibiste una advertencia: {data.get('admin_note', '')}",
            ))

    db.session.commit()
    return jsonify({"report": report.to_dict()}), 200


@admin_bp.route("/users", methods=["GET"])
@admin_required
def get_users():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 30))
    status = request.args.get("status")
    q = User.query
    if status:
        q = q.filter_by(status=status)
    total = q.count()
    users = q.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
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
    total_income = db.session.query(db.func.coalesce(db.func.sum(Listing.total_price), 0)).scalar()
    return jsonify({
        "users": {
            "total": User.query.count(),
            "active": User.query.filter_by(status="active").count(),
            "blocked": User.query.filter_by(status="blocked").count(),
        },
        "listings": {
            "total": Listing.query.count(),
            "active": Listing.query.filter_by(status="active").count(),
            "total_income": total_income
        },
        "groups": {
            "total": Group.query.count(),
            "open": Group.query.filter_by(status="open").count(),
        },
        "reports": {
            "open": Report.query.filter_by(status="open").count(),
            "reviewed": Report.query.filter(Report.status=="reviewed").count(),
            "total": Report.query.count(),
        },
    }), 200