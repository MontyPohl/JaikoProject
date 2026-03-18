"""
Supabase Storage helper — buckets separados por tipo.

Buckets públicos:  profiles | listings | groups
Bucket privado:    verifications  (URL firmada, expira en 1 hora)

Usage:
    from app.utils.storage import upload_image, get_signed_url
    url = upload_image(file_bytes, filename, bucket='profiles')
    signed = get_signed_url('verifications', 'verify_3_abc123.jpg', expires_in=3600)
"""
import os
from supabase import create_client, Client

_client: Client | None = None

# Buckets públicos — acceso directo por URL
PUBLIC_BUCKETS  = {"profiles", "listings", "groups"}
# Bucket privado — requiere URL firmada
PRIVATE_BUCKETS = {"verifications"}


def _get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set")
        _client = create_client(url, key)
    return _client


def upload_image(file_bytes: bytes, filename: str, bucket: str) -> str:
    """
    Sube bytes a Supabase Storage y devuelve la URL pública (o la ruta si es privado).

    Args:
        file_bytes: contenido del archivo
        filename:   nombre del archivo, ej: "3_abc123.jpg"
        bucket:     'profiles' | 'listings' | 'groups' | 'verifications'

    Returns:
        URL pública (buckets públicos) o path relativo (bucket privado)
    """
    client = _get_client()

    client.storage.from_(bucket).upload(
        filename,
        file_bytes,
        {"content-type": _guess_mime(filename), "upsert": "true"},
    )

    if bucket in PUBLIC_BUCKETS:
        # URL pública directa
        return client.storage.from_(bucket).get_public_url(filename)
    else:
        # Para buckets privados devolvemos solo el path,
        # la URL firmada se genera al momento de mostrarla
        return filename


def get_signed_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    """
    Genera una URL firmada temporal para archivos en buckets privados.

    Args:
        bucket:     nombre del bucket (ej: 'verifications')
        path:       ruta del archivo dentro del bucket
        expires_in: segundos hasta que expira (default: 1 hora)

    Returns:
        URL firmada con tiempo de expiración
    """
    client = _get_client()
    result = client.storage.from_(bucket).create_signed_url(path, expires_in)
    return result.get("signedURL") or result.get("signed_url") or ""


def delete_image(bucket: str, path: str) -> None:
    """Elimina un archivo del bucket indicado."""
    client = _get_client()
    client.storage.from_(bucket).remove([path])


def _guess_mime(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    return {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
        "gif": "image/gif",
    }.get(ext, "application/octet-stream")