import os
from dotenv import load_dotenv

# Obtiene la ruta absoluta de la carpeta donde está este archivo
basedir = os.path.abspath(os.path.dirname(__file__))
# Carga el .env forzando la ruta para evitar errores de lectura
load_dotenv(os.path.join(basedir, "..", ".env"))


def _require_env(name: str) -> str:
    """
    Lee una variable de entorno y lanza un error explícito si no existe.

    Por qué existe esta función:
    - os.environ.get("X", "fallback") silencia el problema: el server arranca
      con una clave conocida públicamente, lo que es un riesgo de seguridad.
    - Con esta función el servidor NO arranca si falta la variable, lo que
      obliga a configurarla correctamente antes de seguir.
    """
    value = os.environ.get(name)
    if not value:
        raise EnvironmentError(
            f"\n\n[CONFIG ERROR] La variable de entorno '{name}' es obligatoria "
            f"y no está definida.\n"
            f"Agregá esta línea a tu archivo .env:\n"
            f"  {name}=<tu_valor_secreto_aqui>\n"
        )
    return value


class Config:
    # ── Claves de seguridad (OBLIGATORIAS — sin fallback) ────────────────────
    # BUG #4 CORREGIDO: antes tenían valores por defecto conocidos ("jaiko-dev-secret-123").
    # Cualquier persona que vea el código podía fabricar JWTs válidos con esas claves.
    # Ahora _require_env() hace que el servidor no arranque si no están configuradas.
    SECRET_KEY = _require_env("SECRET_KEY")
    JWT_SECRET_KEY = _require_env("JWT_SECRET_KEY")
    JWT_ACCESS_TOKEN_EXPIRES = 86400 * 7  # 7 días
    # ✅ NUEVO BLOQUE — configuración de cookies JWT
    # Dónde buscar el JWT en cada request: primero en cookie, luego en header.
    # "headers" como fallback permite que la app mobile siga funcionando
    # con su Authorization: Bearer sin cambios.
    JWT_TOKEN_LOCATION = ["cookies", "headers"]

    # httponly=True: JavaScript nunca puede leer esta cookie.
    # Es la propiedad clave que nos protege contra XSS.
    JWT_COOKIE_HTTPONLY = True

    # SameSite=Lax: el browser solo envía la cookie en navegación
    # directa al sitio, no en requests cross-site embedidos.
    # Esto bloquea la mayoría de ataques CSRF sin necesidad de tokens extra.
    JWT_COOKIE_SAMESITE = "Lax"

    # La cookie solo viaja por HTTPS. En desarrollo (False) permite HTTP.
    # Se sobreescribe en ProductionConfig con True.
    JWT_COOKIE_SECURE = False

    # Nombre de la cookie — mantenerlo explícito para claridad
    JWT_ACCESS_COOKIE_NAME = "jaiko_access_token"
    # FIN BLOQUE ✅

    # ── Base de datos ─────────────────────────────────────────────────────────
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", f"sqlite:///{os.path.join(basedir, 'jaiko_dev.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ── Google OAuth ──────────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    # ── Frontend URL para redirección ─────────────────────────────────────────
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    # ── Supabase ──────────────────────────────────────────────────────────────
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
    SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET", "jaiko-media")

    # ── Lógica de negocio ─────────────────────────────────────────────────────
    MATCH_THRESHOLD = 0.80
    MAX_GROUP_MEMBERS = 6


class DevelopmentConfig(Config):
    DEBUG = True
    JWT_COOKIE_SECURE = False


class ProductionConfig(Config):
    DEBUG = False
    JWT_COOKIE_SECURE = True
    # En producción, DATABASE_URL DEBE existir (Postgres, Railway, etc.)
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")


config_map = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}
