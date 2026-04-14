from datetime import datetime
from ..extensions import db


class Group(db.Model):
    __tablename__ = "groups"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    city = db.Column(db.String(100), nullable=False, default="Asunción")
    max_members = db.Column(db.Integer, nullable=False, default=3)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status = db.Column(
        db.String(20), default="open"
    )  # open | full | closed | disbanded
    budget_max = db.Column(db.Integer, nullable=True)
    pets_allowed = db.Column(db.Boolean, default=False)
    smoking_allowed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    creator = db.relationship("User", foreign_keys=[created_by])
    members = db.relationship(
        "GroupMember", back_populates="group", cascade="all, delete-orphan"
    )

    @property
    def current_members(self) -> int:
        return len([m for m in self.members if m.status == "active"])

    @property
    def is_full(self) -> bool:
        return self.current_members >= self.max_members

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "city": self.city,
            "max_members": self.max_members,
            "current_members": self.current_members,
            "created_by": self.created_by,
            "status": self.status,
            "budget_max": self.budget_max,
            "pets_allowed": self.pets_allowed,
            "smoking_allowed": self.smoking_allowed,
            "is_full": self.is_full,
            "members": [m.to_dict() for m in self.members if m.status == "active"],
            "created_at": self.created_at.isoformat(),
        }


class GroupMember(db.Model):
    __tablename__ = "group_members"

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    role = db.Column(db.String(20), default="member")  # admin | member
    status = db.Column(db.String(20), default="active")  # active | left | kicked
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

    group = db.relationship("Group", back_populates="members")
    user = db.relationship("User")

    def to_dict(self) -> dict:
        profile = self.user.profile
        return {
            "id": self.id,
            "user_id": self.user_id,
            "role": self.role,
            "status": self.status,  # ← línea nueva
            "joined_at": self.joined_at.isoformat(),
            "profile": profile.to_dict() if profile else None,
        }
