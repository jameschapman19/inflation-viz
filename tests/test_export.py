import json
from pathlib import Path

from inflation_viz.config import SourceRegistry
from inflation_viz.export import export_web_data


def test_export_web_data_writes_expected_files(
    synthetic_data_dir: Path, registry: SourceRegistry, tmp_path: Path
) -> None:
    out_dir = tmp_path / "web_data"
    export_web_data(data_dir=synthetic_data_dir, out_dir=out_dir, registry=registry)

    for name in ["series.json", "provenance.json", "registry.json", "meta.json"]:
        assert (out_dir / name).exists(), f"{name} was not exported"


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
