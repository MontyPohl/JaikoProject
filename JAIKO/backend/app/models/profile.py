from datetime import datetime
from ..extensions import db


class Profile(db.Model):
    __tablename__ = "profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False
    )
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

    current_roomie_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

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

    # ✅ CÓDIGO CORREGIDO — reemplazá el método to_dict completo
    def to_dict(self, include_private: bool = False) -> dict:
        """
        Serializa el perfil a dict.

        include_private=False (default):
            Vista pública — para búsquedas, perfiles de otros usuarios.
            Omite datos sensibles: enfermedades, coordenadas GPS exactas,
            estado de verificación interno.

        include_private=True:
            Vista completa — solo para el propio usuario en /auth/me
            y /profiles/me. Incluye todos los campos.

        Por qué separar esto:
            'diseases' es dato de salud. Exponerlo viola la privacidad.
            Las coordenadas GPS exactas (lat/lng) revelan dónde vive
            el usuario. En la vista pública solo mostramos ciudad.
        """
        # Resolver current_roomie de forma segura (sin cambios)
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
            "verified": self.verified,
            "is_looking": self.is_looking,
            "pref_min_age": self.pref_min_age,
            "pref_max_age": self.pref_max_age,
            "current_roomie": roomie_data,
            "created_at": self.created_at.isoformat(),
        }

        if include_private:
            # Solo el propio usuario ve estos campos
            data["diseases"] = self.diseases
            data["verification_status"] = self.verification_status
            # Coordenadas GPS exactas: solo para el dueño del perfil
            # (las necesita para ver su pin en el mapa de su propia vista)
            data["lat"] = self.lat
            data["lng"] = self.lng
        else:
            # Vista pública: coordenadas aproximadas (solo ciudad, sin GPS)
            # Para el mapa de búsqueda usamos lat/lng pero con menos precisión:
            # redondeamos a 2 decimales (~1km de imprecisión) para no revelar
            # la dirección exacta del usuario.
            data["lat"] = round(self.lat, 2) if self.lat is not None else None
            data["lng"] = round(self.lng, 2) if self.lng is not None else None

        return data
