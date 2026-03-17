from datetime import datetime
from ..extensions import db
from flask_bcrypt import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=True)
    google_id = db.Column(db.String(255), unique=True, nullable=True)
    role = db.Column(db.String(20), nullable=False, default="user")
    status = db.Column(db.String(20), nullable=False, default="active")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)

    # Relationships
    profile = db.relationship(
        "Profile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    listings = db.relationship(
        "Listing", back_populates="owner", cascade="all, delete-orphan"
    )
    sent_requests = db.relationship(
        "RoommateRequest",
        foreign_keys="RoommateRequest.sender_user_id",
        back_populates="sender",
        cascade="all, delete-orphan"
    )
    received_requests = db.relationship(
        "RoommateRequest",
        foreign_keys="RoommateRequest.target_user_id",
        back_populates="target",
        cascade="all, delete-orphan"
    )
    notifications = db.relationship(
        "Notification", back_populates="user", cascade="all, delete-orphan"
    )
    reviews_given = db.relationship(
        "Review",
        foreign_keys="Review.reviewer_id",
        back_populates="reviewer",
        cascade="all, delete-orphan"
    )
    reviews_received = db.relationship(
        "Review",
        foreign_keys="Review.target_user_id",
        back_populates="target_user",
        cascade="all, delete-orphan"
    )
    reports_filed = db.relationship(
        "Report",
        foreign_keys="Report.reporter_id",
        back_populates="reporter",
        cascade="all, delete-orphan"
    )
    # Arreglo principal: especificar foreign_keys para evitar AmbiguousForeignKeysError
    verification_request = db.relationship(
        "VerificationRequest",
        back_populates="user",
        foreign_keys="VerificationRequest.user_id",
        uselist=False
    )

    # Métodos de password
    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password).decode('utf-8')

    def check_password(self, password: str) -> bool:
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def is_blocked(self) -> bool:
        return self.status == "blocked"

    # Serialización
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "role": self.role,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
        }