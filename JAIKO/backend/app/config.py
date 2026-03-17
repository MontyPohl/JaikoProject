import os
from dotenv import load_dotenv

# Obtiene la ruta absoluta de la carpeta donde está este archivo
basedir = os.path.abspath(os.path.dirname(__file__))
# Carga el .env forzando la ruta para evitar errores de lectura
load_dotenv(os.path.join(basedir, '.env'))

class Config:
    # Claves de seguridad
    SECRET_KEY = os.environ.get("SECRET_KEY", "jaiko-dev-secret-123")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jaiko-jwt-secret-456")
    JWT_ACCESS_TOKEN_EXPIRES = 86400 * 7  # 7 días

    # Base de datos
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        f"sqlite:///{os.path.join(basedir, 'jaiko_dev.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Google OAuth
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "TU_CLIENT_ID_AQUI")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "TU_CLIENT_SECRET_AQUI")

    # Frontend URL para redirección
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    # Supabase (si se usa)
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
    SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET", "jaiko-media")

    # Configuración de lógica de negocio
    MATCH_THRESHOLD = 0.80
    MAX_GROUP_MEMBERS = 6

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False
    # En producción, DATABASE_URL DEBE existir (Postgres, Render/Heroku)
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")

config_map = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}