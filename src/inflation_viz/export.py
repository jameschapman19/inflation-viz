"""Exports `data/latest` + `sources.yaml` to JSON the Next.js app
(`web/src/data/`) reads at build time.

This is the boundary between the Python data pipeline and the frontend:
the pipeline never renders HTML, and the frontend never talks to ONS or
touches parquet directly. `uv run python -m inflation_viz.export` is the
one command that bridges them.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from datetime import date, datetime
from pathlib import Path
from typing import Any

import polars as pl

from inflation_viz.config import REPO_ROOT, SourceRegistry, load_registry
from inflation_viz.storage import (
    DATA_DIR,
    list_vintages,
    read_latest_provenance,
    read_latest_series,
)

DEFAULT_OUT_DIR = REPO_ROOT / "web" / "src" / "data"


def _json_default(value: object) -> str:
    if isinstance(value, date | datetime):
        return value.isoformat()
    raise TypeError(f"Cannot serialize {value!r} of type {type(value)}")


def _write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, default=_json_default, indent=2), encoding="utf-8")


def _registry_payload(registry: SourceRegistry) -> dict[str, Any]:
    return {
        "headline": [asdict(s) for s in registry.headline.values()],
        "divisions": [asdict(s) for s in registry.divisions_sorted()],
        "weights": [asdict(s) for s in registry.weights_sorted()],
        "subdivisions": [asdict(s) for s in registry.subdivisions_sorted()],
        "subdivisionWeights": [asdict(s) for s in registry.subdivision_weights_sorted()],
        "external": [asdict(s) for s in registry.external.values()],
    }


def export_web_data(
    *,
    data_dir: Path = DATA_DIR,
    out_dir: Path = DEFAULT_OUT_DIR,
    registry: SourceRegistry | None = None,
) -> None:
    registry = registry or load_registry()
    out_dir.mkdir(parents=True, exist_ok=True)

    series: pl.DataFrame = read_latest_series(data_dir)
    provenance: pl.DataFrame = read_latest_provenance(data_dir)
    vintages = list_vintages(data_dir)

    _write_json(out_dir / "series.json", series.to_dicts())
    _write_json(out_dir / "provenance.json", provenance.to_dicts())
    _write_json(out_dir / "registry.json", _registry_payload(registry))
    _write_json(
        out_dir / "meta.json",
        {
            "generatedAt": datetime.now().astimezone().isoformat(),
            "latestVintage": vintages[-1] if vintages else None,
        },
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR)
    args = parser.parse_args()
    export_web_data(out_dir=args.out)


if __name__ == "__main__":
    main()
