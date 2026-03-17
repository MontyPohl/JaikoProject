from datetime import datetime
from ..extensions import db


class RoommateRequest(db.Model):
    __tablename__ = "roommate_requests"

    id = db.Column(db.Integer, primary_key=True)
    sender_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    target_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), nullable=True)
    listing_id = db.Column(db.Integer, db.ForeignKey("listings.id"), nullable=True)
    type = db.Column(db.String(30), default="roommate")
    status = db.Column(db.String(20), default="pending")
    message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    sender = db.relationship(
        "User",
        foreign_keys="RoommateRequest.sender_user_id",
        back_populates="sent_requests",
    )
    target = db.relationship(
        "User",
        foreign_keys="RoommateRequest.target_user_id",
        back_populates="received_requests",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "sender_user_id": self.sender_user_id,
            "target_user_id": self.target_user_id,
            "group_id": self.group_id,
            "listing_id": self.listing_id,
            "type": self.type,
            "status": self.status,
            "message": self.message,
            "created_at": self.created_at.isoformat(),
        }


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=True)
    data = db.Column(db.JSON, nullable=True)
    read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", back_populates="notifications")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "content": self.content,
            "data": self.data,
            "read": self.read,
            "created_at": self.created_at.isoformat(),
        }


class Review(db.Model):
    __tablename__ = "reviews"

    id = db.Column(db.Integer, primary_key=True)
    reviewer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    target_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    listing_id = db.Column(db.Integer, db.ForeignKey("listings.id"), nullable=True)
    rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    reviewer = db.relationship(
        "User", foreign_keys="Review.reviewer_id", back_populates="reviews_given"
    )
    target_user = db.relationship(
        "User", foreign_keys="Review.target_user_id", back_populates="reviews_received"
    )
    listing = db.relationship("Listing", back_populates="reviews")

    def to_dict(self) -> dict:
        reviewer_profile = self.reviewer.profile
        return {
            "id": self.id,
            "reviewer_id": self.reviewer_id,
            "reviewer_name": reviewer_profile.name if reviewer_profile else None,
            "reviewer_photo": (
                reviewer_profile.profile_photo_url if reviewer_profile else None
            ),
            "target_user_id": self.target_user_id,
            "listing_id": self.listing_id,
            "rating": self.rating,
            "comment": self.comment,
            "created_at": self.created_at.isoformat(),
        }


class Report(db.Model):
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True)
    reporter_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    reported_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    reported_listing_id = db.Column(
        db.Integer, db.ForeignKey("listings.id"), nullable=True
    )
    reason = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default="open")
    admin_note = db.Column(db.Text, nullable=True)
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    reporter = db.relationship(
        "User", foreign_keys="Report.reporter_id", back_populates="reports_filed"
    )
    reported_user = db.relationship("User", foreign_keys="Report.reported_user_id")
    reviewer = db.relationship("User", foreign_keys="Report.reviewed_by")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "reporter_id": self.reporter_id,
            "reported_user_id": self.reported_user_id,
            "reported_listing_id": self.reported_listing_id,
            "reason": self.reason,
            "description": self.description,
            "status": self.status,
            "admin_note": self.admin_note,
            "created_at": self.created_at.isoformat(),
        }


class VerificationRequest(db.Model):
    __tablename__ = "verification_requests"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False
    )
    selfie_url = db.Column(db.String(500), nullable=True)
    verification_code = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(30), default="pending_verification")
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    rejection_reason = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user = db.relationship(
        "User",
        foreign_keys="VerificationRequest.user_id",
        back_populates="verification_request",
    )
    reviewer = db.relationship("User", foreign_keys="VerificationRequest.reviewed_by")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "verification_code": self.verification_code,
            "status": self.status,
            "selfie_url": self.selfie_url,
            "rejection_reason": self.rejection_reason,
            "created_at": self.created_at.isoformat(),
        }