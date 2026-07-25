from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_SOURCE = ROOT / "apps" / "api" / "src"
OUTPUT = ROOT / "contracts" / "openapi.json"

sys.path.insert(0, str(API_SOURCE))

from alltime25.main import create_app  # noqa: E402


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document = create_app().openapi()
    OUTPUT.write_text(
        json.dumps(document, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
