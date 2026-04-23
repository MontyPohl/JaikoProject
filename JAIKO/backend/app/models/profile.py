from datetime import datetime
from ..extensions import db


class Profile(db.Model):
    __tablename__ = "profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    age = db.Column(db.Integer, nullable=True)
    gender = db.Column(db.String(30), nullable=True)
    profession = db.Column(db.String(100), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    budget_min = db.Column(db.Integer, nullable=True)
    budget_max = db.Column(db.Integer, nullable=True)
    pets = db.Column(db.Boolean, default=False)
    smoker = db.Column(db.Boolean, default=False)
    schedule = db.Column(db.String(30), nullable=True)
    diseases = db.Column(db.Text, nullable=True)
    profile_photo_url = db.Column(db.String(500), nullable=True)
    city = db.Column(db.String(100), nullable=True, default="Asunción", index=True)
    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)
    verified = db.Column(db.Boolean, default=False)
    verification_status = db.Column(db.String(30), default="not_requested")
    is_looking = db.Column(db.Boolean, default=True, index=True)

    current_roomie_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=True
    )

    pref_min_age = db.Column(db.Integer, nullable=True, default=18)
    pref_max_age = db.Column(db.Integer, nullable=True, default=99)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user = db.relationship(
        "User",
        back_populates="profile",
        foreign_keys=[user_id],
    )
    current_roomie = db.relationship(
        "User",
        foreign_keys=[current_roomie_id],
    )

    def to_dict(self, include_private: bool = False) -> dict:
        roomie_data = None
        if self.current_roomie:
            r = self.current_roomie
            roomie_data = {
                "id": r.id,
                "name": r.profile.name if r.profile else None,
                "profile_photo_url": (
                    r.profile.profile_photo_url if r.profile else None
                ),
            }

        data = {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "age": self.age,
            "gender": self.gender,
            "profession": self.profession,
            "bio": self.bio,
            "budget_min": self.budget_min,
            "budget_max": self.budget_max,
            "pets": self.pets,
            "smoker": self.smoker,
            "schedule": self.schedule,
            "profile_photo_url": self.profile_photo_url,
            "city": self.city,
            "lat": self.lat,
            "lng": self.lng,
            "verified": self.verified,
            "verification_status": self.verification_status,
            "is_looking": self.is_looking,
            "pref_min_age": self.pref_min_age,
            "pref_max_age": self.pref_max_age,
            "current_roomie": roomie_data,
            # ── FIX: incluir current_roomie_id como campo explícito ───────────
            # El frontend usa este valor en ProfilePage (isRoomie) y ChatPage.
            # Sin este campo, el frontend recibe undefined y el botón Chat
            # aparece bloqueado aunque el usuario SÍ tenga roomie en la BD.
            "current_roomie_id": self.current_roomie_id,
            "created_at": self.created_at.isoformat(),
        }
        if include_private:
            data["diseases"] = self.diseases
        return data
