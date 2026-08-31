import json
from datetime import UTC, datetime
from pathlib import Path

import polars as pl

from inflation_viz.storage import (
    ProvenanceRecord,
    list_vintages,
    read_latest_forecast,
    read_latest_provenance,
    read_latest_series,
    write_vintage,
)


def _sample_series() -> pl.DataFrame:
    return pl.DataFrame(
        {
            "unique_id": ["GB.CPI", "GB.CPI"],
            "ds": [datetime(2024, 1, 1).date(), datetime(2024, 2, 1).date()],
            "y": [4.0, 3.4],
        }
    )


def _sample_provenance() -> list[ProvenanceRecord]:
    return [
        ProvenanceRecord(
            unique_id="GB.CPI",
            source_name="Office for National Statistics",
            source_url="https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23",
            cdid="D7G7",
            license="Open Government Licence v3.0",
            release_date=datetime(2024, 3, 17, tzinfo=UTC),
            fetched_at=datetime(2024, 3, 20, tzinfo=UTC),
        )
    ]


def test_write_vintage_never_overwrites_and_updates_latest(tmp_path: Path) -> None:
    fetched_at_1 = datetime(2024, 3, 20, 10, 0, tzinfo=UTC)
    vintage_1 = write_vintage(
        _sample_series(), _sample_provenance(), fetched_at=fetched_at_1, data_dir=tmp_path
    )
    assert vintage_1.exists()
    assert read_latest_series(tmp_path).shape == (2, 3)

    fetched_at_2 = datetime(2024, 4, 20, 10, 0, tzinfo=UTC)
    updated_series = pl.DataFrame(
        {"unique_id": ["GB.CPI"], "ds": [datetime(2024, 3, 1).date()], "y": [3.2]}
    )
    vintage_2 = write_vintage(
        updated_series, _sample_provenance(), fetched_at=fetched_at_2, data_dir=tmp_path
    )

    assert vintage_1 != vintage_2
    assert vintage_1.exists(), "old vintage must not be deleted or overwritten"
    assert read_latest_series(tmp_path).shape == (1, 3), "latest must point at the newest vintage"
    assert list_vintages(tmp_path) == sorted(list_vintages(tmp_path))


def test_read_latest_forecast_returns_none_when_absent(tmp_path: Path) -> None:
    assert read_latest_forecast(tmp_path) is None


def test_read_latest_forecast_reads_the_committed_export(tmp_path: Path) -> None:
    forecast_dir = tmp_path / "forecast"
    forecast_dir.mkdir(parents=True)
    payload = {"schemaVersion": 1, "points": [{"unique_id": "GB.CP01", "yhat": 0.3}]}
    (forecast_dir / "latest.json").write_text(json.dumps(payload))

    assert read_latest_forecast(tmp_path) == payload


def test_provenance_round_trips(tmp_path: Path) -> None:
    fetched_at = datetime(2024, 3, 20, 10, 0, tzinfo=UTC)
    write_vintage(_sample_series(), _sample_provenance(), fetched_at=fetched_at, data_dir=tmp_path)

    provenance = read_latest_provenance(tmp_path)
    assert provenance["cdid"].to_list() == ["D7G7"]
    assert provenance["license"].to_list() == ["Open Government Licence v3.0"]


def test_list_vintages_empty_when_no_data(tmp_path: Path) -> None:
    assert list_vintages(tmp_path) == []
