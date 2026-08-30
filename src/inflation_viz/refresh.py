"""End-to-end refresh: fetch every series, fetch basket weights, rebuild the
site. This is the single script scheduled CI runs to keep the site current —
`uv run python -m inflation_viz.refresh`.
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

import polars as pl
import requests

from inflation_viz.config import load_registry
from inflation_viz.fetch import fetch_all
from inflation_viz.site.build import build_site
from inflation_viz.storage import write_weights
from inflation_viz.weights import DivisionWeight, fetch_weights

logger = logging.getLogger(__name__)


def _weights_to_frame(weights: list[DivisionWeight]) -> pl.DataFrame:
    return pl.DataFrame(
        {
            "coicop": [w.coicop for w in weights],
            "division_name": [w.division_name for w in weights],
            "weight_per_mille": [w.weight_per_mille for w in weights],
        }
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("public"))
    parser.add_argument(
        "--skip-weights",
        action="store_true",
        help="Skip the basket-weights fetch (it depends on scraping the ONS dataset page).",
    )
    args = parser.parse_args()

    registry = load_registry()
    vintage_path = fetch_all(registry)

    if not args.skip_weights:
        with requests.Session() as session:
            try:
                weights = fetch_weights(registry.reference_tables["basket_weights"], session)
                write_weights(_weights_to_frame(weights), vintage_path)
            except (requests.RequestException, ValueError):
                logger.exception(
                    "Basket weights fetch failed; continuing without an updated weights snapshot."
                )

    build_site(out_dir=args.out, registry=registry)


if __name__ == "__main__":
    main()
