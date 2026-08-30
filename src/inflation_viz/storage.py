"""Flat-file storage for fetched series, with provenance stored alongside
values (not just in docs) and vintage snapshots that are never overwritten
in place.

Layout::

    data/vintages/{fetched_at:%Y-%m-%dT%H%M%SZ}/series.parquet      unique_id, ds, y
    data/vintages/{fetched_at:%Y-%m-%dT%H%M%SZ}/provenance.parquet  one row per series
    data/latest/series.parquet                                     copy of the newest vintage
    data/latest/provenance.parquet

Each fetch run writes a new vintage directory and then refreshes `data/latest`
to point at it. `data/latest` is what the site build reads; the vintage
history is what a future point-in-time backtest (inflation-forecast) reads.
This mirrors the point-in-time integrity requirement in the build spec (§4)
without building the full versioned backtest store here — that's explicitly
a Phase 2 (inflation-forecast) requirement.
"""

from __future__ import annotations

import shutil
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import polars as pl

from inflation_viz.config import REPO_ROOT

DATA_DIR = REPO_ROOT / "data"
VINTAGES_DIR = DATA_DIR / "vintages"
LATEST_DIR = DATA_DIR / "latest"

SERIES_SCHEMA = {"unique_id": pl.Utf8, "ds": pl.Date, "y": pl.Float64}
PROVENANCE_SCHEMA = {
    "unique_id": pl.Utf8,
    "source_name": pl.Utf8,
    "source_url": pl.Utf8,
    "cdid": pl.Utf8,
    "license": pl.Utf8,
    "release_date": pl.Date,
    "fetched_at": pl.Datetime,
    "next_release_date": pl.Date,
}


@dataclass(frozen=True, slots=True)
class ProvenanceRecord:
    unique_id: str
    source_name: str
    source_url: str
    cdid: str
    license: str
    release_date: datetime
    fetched_at: datetime
    next_release_date: datetime | None = None


def vintage_dir_name(fetched_at: datetime) -> str:
    return fetched_at.astimezone(UTC).strftime("%Y-%m-%dT%H%M%SZ")


def write_vintage(
    series: pl.DataFrame,
    provenance: list[ProvenanceRecord],
    *,
    fetched_at: datetime,
    data_dir: Path = DATA_DIR,
) -> Path:
    """Write a new, immutable vintage snapshot and repoint `latest` at it."""
    vintage_path = data_dir / "vintages" / vintage_dir_name(fetched_at)
    vintage_path.mkdir(parents=True, exist_ok=False)

    series.select(["unique_id", "ds", "y"]).write_parquet(vintage_path / "series.parquet")

    prov_df = pl.DataFrame(
        {
            "unique_id": [p.unique_id for p in provenance],
            "source_name": [p.source_name for p in provenance],
            "source_url": [p.source_url for p in provenance],
            "cdid": [p.cdid for p in provenance],
            "license": [p.license for p in provenance],
            "release_date": [p.release_date.date() for p in provenance],
            "fetched_at": [p.fetched_at for p in provenance],
            "next_release_date": [
                p.next_release_date.date() if p.next_release_date else None for p in provenance
            ],
        }
    )
    prov_df.write_parquet(vintage_path / "provenance.parquet")

    latest_path = data_dir / "latest"
    if latest_path.exists():
        shutil.rmtree(latest_path)
    shutil.copytree(vintage_path, latest_path)

    return vintage_path


def write_weights(weights: pl.DataFrame, vintage_path: Path, *, data_dir: Path = DATA_DIR) -> None:
    """Attach a basket-weights snapshot to an existing vintage and refresh `latest`."""
    weights.write_parquet(vintage_path / "weights.parquet")
    latest_path = data_dir / "latest"
    weights.write_parquet(latest_path / "weights.parquet")


def read_latest_series(data_dir: Path = DATA_DIR) -> pl.DataFrame:
    return pl.read_parquet(data_dir / "latest" / "series.parquet")


def read_latest_provenance(data_dir: Path = DATA_DIR) -> pl.DataFrame:
    return pl.read_parquet(data_dir / "latest" / "provenance.parquet")


def list_vintages(data_dir: Path = DATA_DIR) -> list[str]:
    vintages_dir = data_dir / "vintages"
    if not vintages_dir.exists():
        return []
    return sorted(p.name for p in vintages_dir.iterdir() if p.is_dir())
