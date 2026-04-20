# unificar.py
# Genera contexto_completo_jaiko.txt con toda la estructura y código del proyecto.
# Ejecutar desde la raíz del proyecto: python unificar.py

import os

# ── Carpetas raíz a incluir ───────────────────────────────────────────────────
INCLUDE_ROOTS = [
    "backend",
    "frontend",
    "mobile",
    "shared",
]

# ── Carpetas a ignorar completamente ─────────────────────────────────────────
IGNORE_DIRS = {
    "node_modules",
    ".expo",
    ".vite",
    "dist",
    "build",
    "web-build",
    ".git",
    "__pycache__",
    ".venv",
    "venv",
    "migrations",
    ".pytest_cache",
    "android",
    "ios",
    ".vscode",
    "scripts",
    "assets",
    "images",
}

# ── Archivos a ignorar ────────────────────────────────────────────────────────
IGNORE_FILES = {
    ".env",
    ".DS_Store",
    "package-lock.json",
    "yarn.lock",
    "contexto_completo_jaiko.txt",
    "unificar.py",
    "expo-env.d.ts",
    "eslint.config.js",
    "tsconfig.json",
    "babel.config.js",
    "metro.config.js",
    "postcss.config.js",
    "tailwind.config.js",
    "reset-project.js",
}

# ── Extensiones de archivos a incluir ────────────────────────────────────────
INCLUDE_EXTENSIONS = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".json",
    ".md",
    ".env.example",
}

# ── Archivos específicos a incluir siempre (sin importar extensión) ───────────
ALWAYS_INCLUDE = {
    "package.json",
    "app.json",
    "vite.config.js",
    ".env.example",
    "run.py",
}

OUTPUT_FILE = "contexto_completo_jaiko.txt"


def should_include_file(filename: str) -> bool:
    if filename in IGNORE_FILES:
        return False
    if filename in ALWAYS_INCLUDE:
        return True
    _, ext = os.path.splitext(filename)
    return ext in INCLUDE_EXTENSIONS


def build_tree(root_path: str, prefix: str = "") -> list[str]:
    """Genera el árbol de directorios como lista de strings."""
    lines = []
    try:
        entries = sorted(os.listdir(root_path))
    except PermissionError:
        return lines

    entries = [
        e
        for e in entries
        if e not in IGNORE_DIRS and e not in IGNORE_FILES and not e.startswith(".")
    ]

    for i, entry in enumerate(entries):
        full_path = os.path.join(root_path, entry)
        connector = "└── " if i == len(entries) - 1 else "├── "
        lines.append(f"{prefix}{connector}{entry}")
        if os.path.isdir(full_path):
            extension = "    " if i == len(entries) - 1 else "│   "
            lines.extend(build_tree(full_path, prefix + extension))

    return lines


def collect_files(root_path: str) -> list[str]:
    """Recolecta todos los archivos a incluir en el contexto."""
    file_paths = []
    for dirpath, dirnames, filenames in os.walk(root_path):
        # Filtrar carpetas ignoradas en el walk
        dirnames[:] = [
            d
            for d in sorted(dirnames)
            if d not in IGNORE_DIRS and not d.startswith(".")
        ]
        for filename in sorted(filenames):
            if should_include_file(filename):
                file_paths.append(os.path.join(dirpath, filename))

    return file_paths


def main():
    # Detectar raíz del proyecto (donde está este script)
    script_dir = os.path.dirname(os.path.abspath(__file__))

    output_path = os.path.join(script_dir, OUTPUT_FILE)

    with open(output_path, "w", encoding="utf-8") as out:

        # ── Árbol de estructura ───────────────────────────────────────────────
        out.write("ESTRUCTURA DEL PROYECTO:\n")
        out.write("./\n")

        for root_name in INCLUDE_ROOTS:
            root_path = os.path.join(script_dir, root_name)
            if not os.path.exists(root_path):
                continue
            out.write(f"    {root_name}/\n")
            tree_lines = build_tree(root_path, prefix="        ")
            for line in tree_lines:
                out.write(f"{line}\n")

        # ── Contenido de archivos ─────────────────────────────────────────────
        out.write("\n" + "=" * 50 + "\n")
        out.write("CONTENIDO DE LOS ARCHIVOS\n")
        out.write("=" * 50 + "\n\n")

        for root_name in INCLUDE_ROOTS:
            root_path = os.path.join(script_dir, root_name)
            if not os.path.exists(root_path):
                continue

            files = collect_files(root_path)
            for file_path in files:
                relative_path = os.path.relpath(file_path, script_dir)
                out.write(f"\nFILE_PATH: .\\{relative_path}\n")
                out.write("-" * 40 + "\n")
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        out.write(f.read())
                except Exception as e:
                    out.write(f"[Error leyendo archivo: {e}]\n")
                out.write("\n")

    print(f"✅ Contexto generado: {OUTPUT_FILE}")
    print(f"   Carpetas incluidas: {', '.join(INCLUDE_ROOTS)}")


if __name__ == "__main__":
    main()
