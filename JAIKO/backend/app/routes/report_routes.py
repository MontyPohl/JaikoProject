from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import Report
from ..utils.jwt_helpers import get_current_user_id

report_bp = Blueprint("reports", __name__)

VALID_REASONS = [
    "spam",
    "fake_profile",
    "harassment",
    "inappropriate_content",
    "scam",
    "hate_speech",
    "other",
]


@report_bp.route("/", methods=["POST"])
@jwt_required()
def create_report():
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    data = request.get_json()

    if not data.get("reason") or data["reason"] not in VALID_REASONS:
        return jsonify({"error": f"reason must be one of {VALID_REASONS}"}), 400

    if not data.get("reported_user_id") and not data.get("reported_listing_id"):
        return (
            jsonify({"error": "reported_user_id or reported_listing_id required"}),
            400,
        )

    report = Report(
        reporter_id=user_id,
        reported_user_id=data.get("reported_user_id"),
        reported_listing_id=data.get("reported_listing_id"),
        reason=data["reason"],
        description=data.get("description"),
    )
    db.session.add(report)
    db.session.commit()
    return jsonify({"message": "Report submitted", "report": report.to_dict()}), 201


@report_bp.route("/my", methods=["GET"])
@jwt_required()
def my_reports():
    # BUG CORREGIDO: int(get_jwt_identity()) → get_current_user_id()
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    reports = (
        Report.query.filter_by(reporter_id=user_id)
        .order_by(Report.created_at.desc())
        .all()
    )
    return jsonify({"reports": [r.to_dict() for r in reports]}), 200
