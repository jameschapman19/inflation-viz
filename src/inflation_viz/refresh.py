"""End-to-end refresh: fetch every series (headline, divisions, and basket
weights — all plain ONS CDIDs, all fetched the same way) and export it to
JSON for the Next.js app in `web/`. This is the single script scheduled CI
runs to keep the site current — `uv run python -m inflation_viz.refresh`.
"""

from __future__ import annotations

from inflation_viz.config import load_registry
from inflation_viz.export import export_web_data
from inflation_viz.fetch import fetch_all


def main() -> None:
    registry = load_registry()
    fetch_all(registry)
    export_web_data(registry=registry)


if __name__ == "__main__":
    main()
