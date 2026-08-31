import json
from pathlib import Path

from inflation_viz.config import SourceRegistry
from inflation_viz.export import EMPTY_FORECAST_EXPORT, export_forecast, export_web_data


def test_export_web_data_writes_expected_files(
    synthetic_data_dir: Path, registry: SourceRegistry, tmp_path: Path
) -> None:
    out_dir = tmp_path / "web_data"
    export_web_data(data_dir=synthetic_data_dir, out_dir=out_dir, registry=registry)

    for name in ["series.json", "provenance.json", "registry.json", "meta.json", "forecast.json"]:
        assert (out_dir / name).exists(), f"{name} was not exported"


def test_export_forecast_writes_placeholder_when_no_run_has_landed(
    synthetic_data_dir: Path, tmp_path: Path
) -> None:
    """`synthetic_data_dir` never writes `data/forecast/` — this must not
    break the build, and must produce a schema the frontend can render as
    "no forecast yet" rather than crashing on a missing file.
    """
    out_dir = tmp_path / "web_data"
    export_forecast(data_dir=synthetic_data_dir, out_dir=out_dir)

    payload = json.loads((out_dir / "forecast.json").read_text())
    assert payload == EMPTY_FORECAST_EXPORT
    assert payload["points"] == []
    assert payload["coverage"] == {"included": [], "missing": []}


def test_export_forecast_copies_the_committed_export_verbatim(
    synthetic_data_dir: Path, tmp_path: Path
) -> None:
    forecast_dir = synthetic_data_dir / "forecast"
    forecast_dir.mkdir(parents=True)
    payload = {
        "schemaVersion": 1,
        "generatedAt": "2024-04-02T12:00:00+00:00",
        "dataVintage": "2024-04-02T090000Z",
        "model": "AutoARIMA",
        "reconciliation": "BottomUp",
        "level": 80,
        "coverage": {"included": ["GB.CP01"], "missing": []},
        "totalUniqueId": "GB.CPI.FORECAST.BOTTOMUP",
        "points": [{"unique_id": "GB.CP01", "ds": "2024-04-01", "yhat": 0.3, "lo": 0.2, "hi": 0.4}],
    }
    (forecast_dir / "latest.json").write_text(json.dumps(payload))

    out_dir = tmp_path / "web_data"
    export_forecast(data_dir=synthetic_data_dir, out_dir=out_dir)

    assert json.loads((out_dir / "forecast.json").read_text()) == payload


def test_exported_series_json_has_a_row_per_series_per_date(
    synthetic_data_dir: Path, registry: SourceRegistry, tmp_path: Path
) -> None:
    out_dir = tmp_path / "web_data"
    export_web_data(data_dir=synthetic_data_dir, out_dir=out_dir, registry=registry)

    series = json.loads((out_dir / "series.json").read_text())
    unique_ids = {row["unique_id"] for row in series}
    assert unique_ids == set(registry.all_series)
    assert all(isinstance(row["ds"], str) for row in series)
    assert all(isinstance(row["y"], float) for row in series)


def test_exported_registry_json_lists_every_group(
    synthetic_data_dir: Path, registry: SourceRegistry, tmp_path: Path
) -> None:
    out_dir = tmp_path / "web_data"
    export_web_data(data_dir=synthetic_data_dir, out_dir=out_dir, registry=registry)

    payload = json.loads((out_dir / "registry.json").read_text())
    assert len(payload["headline"]) == len(registry.headline)
    assert len(payload["divisions"]) == 12
    assert len(payload["weights"]) == 12
    assert len(payload["subdivisions"]) == len(registry.subdivisions)
    assert len(payload["subdivisionWeights"]) == len(registry.subdivision_weights)
    exported_cdids = {d["cdid"] for d in payload["divisions"]}
    assert exported_cdids == {s.cdid for s in registry.divisions.values()}
    exported_sub_coicops = {d["coicop"] for d in payload["subdivisions"]}
    assert exported_sub_coicops == {s.coicop for s in registry.subdivisions.values()}


def test_exported_meta_json_has_generated_at_and_vintage(
    synthetic_data_dir: Path, registry: SourceRegistry, tmp_path: Path
) -> None:
    out_dir = tmp_path / "web_data"
    export_web_data(data_dir=synthetic_data_dir, out_dir=out_dir, registry=registry)

    meta = json.loads((out_dir / "meta.json").read_text())
    assert meta["generatedAt"]
    assert meta["latestVintage"]
