"""
app/utils/query_helpers.py
──────────────────────────
Utilidades compartidas para construir queries dinámicas en los endpoints.

Por qué existe este archivo:
    La función parse_bool ya existía en profile_routes.py como _parse_bool.
    Ahora group_routes.py también la necesita para los nuevos filtros.
    En vez de copiarla (duplicar código = bug duplicado), la movemos acá.

    Principio: DRY — Don't Repeat Yourself.
    Si mañana cambia la lógica de "qué es true", se arregla en un solo lugar.
"""


def parse_bool(value: str | None) -> bool | None:
    """
    Convierte un query param de URL a bool o None.

    Por qué Flask no lo hace solo:
        request.args.get("pets") devuelve el STRING "false", no el bool False.
        En Python, cualquier string no vacío — incluyendo "false" — es truthy.
        Sin esta función, filtrar pets=false NO filtraría nada.

    Valores aceptados:
        "true",  "1", "yes" → True   (usuario quiere que sea True)
        "false", "0", "no"  → False  (usuario quiere que sea False)
        None, ""             → None  (filtro no enviado → no se aplica)

    Args:
        value: string crudo del query param (o None si no vino).

    Returns:
        True, False, o None.
    """
    if value is None or value == "":
        return None
    return value.lower() in ("true", "1", "yes")
