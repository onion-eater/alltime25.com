from __future__ import annotations

import argparse
from pathlib import Path

from scripts.catalog.build_catalog import verify_manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog-root", type=Path, default=Path("catalog"))
    parser.add_argument("--catalog-id", required=True)
    args = parser.parse_args()
    verify_manifest(args.catalog_root, args.catalog_id)
    print(f"Verified catalog {args.catalog_id}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
