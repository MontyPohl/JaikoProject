from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import RoommateRequest, Chat, ChatMember
from ..services.notification_service import send_notification

request_bp = Blueprint("requests", __name__)

@request_bp.route("/", methods=["POST"])
@jwt_required()
def create_request():
    user_id = int(get_jwt_identity())
    data = request.get_json()

    req_type = data.get("type", "roommate")
    target = data.get("target_user_id")
    group_id = data.get("group_id")
    listing_id = data.get("listing_id")

    if not target and not group_id and not listing_id:
        return jsonify({"error": "target_user_id, group_id, or listing_id required"}), 400

    # Check duplicate
    existing = RoommateRequest.query.filter_by(
        sender_user_id=user_id,
        target_user_id=target,
        group_id=group_id,
        listing_id=listing_id,
        status="pending",
    ).first()
    if existing:
        return jsonify({"error": "Request already pending"}), 409

    req = RoommateRequest(
        sender_user_id=user_id,
        target_user_id=target,
        group_id=group_id,
        listing_id=listing_id,
        type=req_type,
        message=data.get("message"),
    )
    db.session.add(req)
    db.session.flush()

    # Notify target
    if target:
        send_notification(
            user_id=target,
            type="match_request",
            title="Nueva solicitud de roomie",
            content=f"Alguien quiere ser tu roomie",
            data={"request_id": req.id, "sender_id": user_id},  # <-- importante
        )
    db.session.commit()
    return jsonify({"request": req.to_dict()}), 201