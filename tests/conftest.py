from datetime import UTC, datetime
from pathlib import Path

import polars as pl
import pytest

from inflation_viz.config import SourceRegistry, load_registry
from inflation_viz.storage import ProvenanceRecord, write_vintage, write_weights


@pytest.fixture
def registry() -> SourceRegistry:
    return load_registry()


@pytest.fixture
def synthetic_data_dir(tmp_path: Path, registry: SourceRegistry) -> Path:
    """A tiny, internally-consistent data/latest — enough to build every
    chart and page without hitting the network. Values are synthetic
    placeholders, never used outside tests.
    """
    dates = [datetime(2024, 1, 1).date(), datetime(2024, 2, 1).date()]
    rows = []
    for uid in registry.all_series:
        for i, d in enumerate(dates):
            rows.append({"unique_id": uid, "ds": d, "y": 1.0 + i * 0.1})
    series = pl.DataFrame(rows, schema={"unique_id": pl.Utf8, "ds": pl.Date, "y": pl.Float64})

    provenance = [
        ProvenanceRecord(
            unique_id=uid,
            source_name=source.source_name,
            source_url=source.source_url,
            cdid=source.cdid,
            license=source.license,
            release_date=datetime(2024, 3, 1, tzinfo=UTC),
            fetched_at=datetime(2024, 3, 2, tzinfo=UTC),
        )
        for uid, source in registry.all_series.items()
    ]

    vintage_path = write_vintage(
        series, provenance, fetched_at=datetime(2024, 3, 2, tzinfo=UTC), data_dir=tmp_path
    )

    weights = pl.DataFrame(
        {
            "coicop": [d.coicop for d in registry.divisions_sorted()],
            "division_name": [d.division_name for d in registry.divisions_sorted()],
            "weight_per_mille": [100.0 for _ in registry.divisions_sorted()],
        }
    )
    write_weights(weights, vintage_path, data_dir=tmp_path)

    return tmp_path
