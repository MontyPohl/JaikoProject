from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from .user import User  
from datetime import datetime

profile_bp = Blueprint('profile', __name__, url_prefix='/profiles')

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
    city = db.Column(db.String(100), nullable=True, default="Asunción")
    lat = db.Column(db.Float, nullable=True)  # Nueva columna latitud
    lng = db.Column(db.Float, nullable=True)  # Nueva columna longitud
    verified = db.Column(db.Boolean, default=False)
    verification_status = db.Column(db.String(30), default="not_requested")
    is_looking = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    user = db.relationship("User", back_populates="profile")

    def to_dict(self, include_private: bool = False) -> dict:
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
            "lat": self.lat,   # Se retorna lat
            "lng": self.lng,   # Se retorna lng
            "verified": self.verified,
            "verification_status": self.verification_status,
            "is_looking": self.is_looking,
            "created_at": self.created_at.isoformat(),
        }
        if include_private:
            data["diseases"] = self.diseases
        return data


@profile_bp.route('/me', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.profile:
        return jsonify({"error": "Perfil no encontrado"}), 404

    data = request.json
    profile = user.profile

    # Actualizar campos
    profile.name = data.get('name', profile.name)
    profile.age = data.get('age', profile.age)
    profile.gender = data.get('gender', profile.gender)
    profile.profession = data.get('profession', profile.profession)
    profile.bio = data.get('bio', profile.bio)
    profile.budget_min = data.get('budget_min', profile.budget_min)
    profile.budget_max = data.get('budget_max', profile.budget_max)
    profile.pets = data.get('pets', profile.pets)
    profile.smoker = data.get('smoker', profile.smoker)
    profile.schedule = data.get('schedule', profile.schedule)
    profile.city = data.get('city', profile.city)
    profile.lat = data.get('lat', profile.lat)  # Guardar lat
    profile.lng = data.get('lng', profile.lng)  # Guardar lng
    profile.is_looking = data.get('is_looking', profile.is_looking)

    db.session.commit()

    return jsonify({"profile": profile.to_dict()}), 200