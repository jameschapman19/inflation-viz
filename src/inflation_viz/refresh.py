"""End-to-end refresh: fetch every series (headline, divisions, and basket
weights — all plain ONS CDIDs, all fetched the same way) and rebuild the
site. This is the single script scheduled CI runs to keep the site current —
`uv run python -m inflation_viz.refresh`.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from inflation_viz.config import load_registry
from inflation_viz.fetch import fetch_all
from inflation_viz.site.build import build_site


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("public"))
    args = parser.parse_args()

    registry = load_registry()
    fetch_all(registry)
    build_site(out_dir=args.out, registry=registry)


if __name__ == "__main__":
    main()
