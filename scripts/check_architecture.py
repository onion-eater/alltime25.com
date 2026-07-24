from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "apps" / "api" / "src" / "blind50"
FRONTEND = ROOT / "apps" / "web" / "src"
ARCHIVE = ROOT / "archive"
CATALOG = ROOT / "catalog"
IGNORED_PARTS = {
    ".git",
    ".playwright",
    ".venv",
    "__pycache__",
    "node_modules",
}

IMPORT_RE = re.compile(
    r"""(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']"""
)
COLOR_RE = re.compile(
    r":\s*(?:#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|(?:black|white)\b)",
    re.IGNORECASE,
)


def python_imports(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    imports: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add(node.module)
    return imports


def check_backend(errors: list[str]) -> None:
    if not BACKEND.exists():
        return

    forbidden_by_layer = {
        "domain": (
            "fastapi",
            "pydantic",
            "sqlalchemy",
            "blind50.api",
            "blind50.application",
            "blind50.infrastructure",
        ),
        "application": (
            "fastapi",
            "sqlalchemy",
            "blind50.api",
            "blind50.infrastructure",
        ),
        "infrastructure": ("blind50.api",),
        "api": ("blind50.infrastructure",),
    }

    for path in BACKEND.rglob("*.py"):
        relative = path.relative_to(BACKEND)
        if path.name == "main.py" or not relative.parts:
            continue
        layer = relative.parts[0]
        forbidden = forbidden_by_layer.get(layer, ())
        for imported in python_imports(path):
            if any(
                imported == prefix or imported.startswith(f"{prefix}.")
                for prefix in forbidden
            ):
                errors.append(f"{relative}: {layer} may not import {imported}")
            if (
                layer == "domain"
                and not imported.startswith("blind50.domain")
                and imported.split(".", 1)[0] not in sys.stdlib_module_names
            ):
                errors.append(
                    f"{relative}: domain may only import stdlib or blind50.domain"
                )


def resolve_frontend_import(path: Path, specifier: str) -> Path | None:
    if specifier.startswith("@/"):
        return FRONTEND / specifier[2:]
    if specifier.startswith("."):
        return (path.parent / specifier).resolve()
    return None


def frontend_layer(path: Path) -> tuple[str, str | None]:
    relative = path.relative_to(FRONTEND)
    layer = relative.parts[0] if relative.parts else ""
    feature = (
        relative.parts[1] if layer == "features" and len(relative.parts) > 1 else None
    )
    return layer, feature


def check_frontend(errors: list[str]) -> None:
    if not FRONTEND.exists():
        return

    for path in FRONTEND.rglob("*"):
        if path.name in {"index.ts", "index.tsx"}:
            errors.append(f"{path.relative_to(ROOT)}: barrel files are prohibited")

    for path in (*FRONTEND.rglob("*.ts"), *FRONTEND.rglob("*.tsx")):
        source_layer, source_feature = frontend_layer(path)
        source = path.read_text(encoding="utf-8")
        for specifier in IMPORT_RE.findall(source):
            resolved = resolve_frontend_import(path, specifier)
            if resolved is None:
                continue
            if resolved.is_relative_to(ARCHIVE):
                errors.append(
                    f"{path.relative_to(ROOT)}: active code may not import {specifier}"
                )
                continue
            try:
                target_layer, target_feature = frontend_layer(resolved)
            except ValueError:
                continue
            if source_layer == "shared" and target_layer in {"features", "app"}:
                errors.append(
                    f"{path.relative_to(ROOT)}: shared may not import {specifier}"
                )
            if source_layer == "features" and target_layer == "app":
                errors.append(
                    f"{path.relative_to(ROOT)}: features may not import {specifier}"
                )
            if (
                source_layer == "features"
                and target_layer == "features"
                and source_feature != target_feature
            ):
                errors.append(
                    f"{path.relative_to(ROOT)}: features may not cross-import {specifier}"
                )

    tokens = FRONTEND / "shared" / "styles" / "tokens.css"
    for path in FRONTEND.rglob("*.css"):
        if path == tokens:
            continue
        for line_number, line in enumerate(
            path.read_text(encoding="utf-8").splitlines(), start=1
        ):
            if COLOR_RE.search(line) and not line.lstrip().startswith("/*"):
                errors.append(
                    f"{path.relative_to(ROOT)}:{line_number}: "
                    "shared colors belong in tokens.css"
                )


def check_catalog(errors: list[str]) -> None:
    if not ROOT.exists():
        return
    current_pointer = CATALOG / "data" / "current.json"
    if not current_pointer.is_file():
        errors.append("catalog/data/current.json: current catalog pointer is required")
    for path in ROOT.rglob("players.json"):
        if any(part in IGNORED_PARTS for part in path.parts):
            continue
        try:
            relative = path.relative_to(CATALOG)
        except ValueError:
            errors.append(
                f"{path.relative_to(ROOT)}: player catalogs belong under catalog/"
            )
            continue
        parts = relative.parts
        if (
            len(parts) != 4
            or parts[0:2] != ("data", "catalogs")
            or parts[3:] != ("players.json",)
        ):
            errors.append(
                f"{path.relative_to(ROOT)}: players.json must use "
                "catalog/data/catalogs/<catalog-id>/players.json"
            )
    for path in ROOT.rglob("pools.json"):
        if any(part in IGNORED_PARTS for part in path.parts):
            continue
        try:
            relative = path.relative_to(CATALOG)
        except ValueError:
            errors.append(
                f"{path.relative_to(ROOT)}: candidate pools belong under catalog/"
            )
            continue
        parts = relative.parts
        if (
            len(parts) != 4
            or parts[0:2] != ("data", "catalogs")
            or parts[3:] != ("pools.json",)
        ):
            errors.append(
                f"{path.relative_to(ROOT)}: pools.json must use "
                "catalog/data/catalogs/<catalog-id>/pools.json"
            )


def main() -> int:
    errors: list[str] = []
    check_backend(errors)
    check_frontend(errors)
    check_catalog(errors)
    if errors:
        print("Architecture violations:")
        for error in sorted(errors):
            print(f"- {error}")
        return 1
    print("Architecture checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
