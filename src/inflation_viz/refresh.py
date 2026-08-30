"""End-to-end refresh: discover every series ONS currently publishes
(headline, divisions, and the full COICOP sub-division tree — see
`ons_catalog.py`, nothing here is a hardcoded CDID list), fetch them all,
and export the result to JSON for the Next.js app in `web/`. This is the
single script scheduled CI runs to keep the site current —
`uv run python -m inflation_viz.refresh`.
"""

from __future__ import annotations

from inflation_viz.export import export_web_data
from inflation_viz.fetch import fetch_all
from inflation_viz.ons_catalog import discover_registry


def main() -> None:
    registry = discover_registry()
    fetch_all(registry)
    export_web_data(registry=registry)


if __name__ == "__main__":
    main()
