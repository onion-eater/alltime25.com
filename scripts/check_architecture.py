from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "apps" / "web" / "src"
CATALOG = ROOT / "catalog"
FORBIDDEN_RUNTIME_PATHS = (
    ROOT / "apps" / "api" / "src",
    ROOT / "contracts",
    ROOT / "Dockerfile",
    ROOT / "compose.yml",
)
IGNORED_PARTS = {
    ".git",
    ".playwright",
    ".venv",
    "__pycache__",
    "dist",
    "node_modules",
}

IMPORT_RE = re.compile(
    r"""(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']"""
)
COLOR_RE = re.compile(
    r":\s*(?:#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|(?:black|white)\b)",
    re.IGNORECASE,
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
            if specifier.startswith("@/shared/api") or "/api/" in specifier:
                errors.append(
                    f"{path.relative_to(ROOT)}: runtime API imports are prohibited"
                )
            resolved = resolve_frontend_import(path, specifier)
            if resolved is None:
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
                    f"{path.relative_to(ROOT)}: features may not "
                    f"cross-import {specifier}"
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


def check_runtime(errors: list[str]) -> None:
    for path in FORBIDDEN_RUNTIME_PATHS:
        if path.exists():
            errors.append(
                f"{path.relative_to(ROOT)}: client-only runtime "
                "may not include this path"
            )


def check_catalog(errors: list[str]) -> None:
    if not ROOT.exists():
        return
    current_pointer = CATALOG / "current.json"
    if not current_pointer.is_file():
        errors.append("catalog/current.json: current catalog pointer is required")
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
        if len(parts) != 3 or parts[0] != "versions" or parts[2] != "players.json":
            errors.append(
                f"{path.relative_to(ROOT)}: players.json must use "
                "catalog/versions/<catalog-id>/players.json"
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
        if len(parts) != 3 or parts[0] != "versions" or parts[2] != "pools.json":
            errors.append(
                f"{path.relative_to(ROOT)}: pools.json must use "
                "catalog/versions/<catalog-id>/pools.json"
            )


def main() -> int:
    errors: list[str] = []
    check_runtime(errors)
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
