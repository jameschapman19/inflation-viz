import json
import os
from pathlib import Path

import polars as pl
import pytest

from agriculture_viz import pipeline
from agriculture_viz.pipeline import country_for_m49, normalize_value


@pytest.mark.parametrize(
    "unit,value,expected", [("kg/ha", 5940, 5.94), ("hg/ha", 59400, 5.94), ("t/ha", 5.94, 5.94)]
)
def test_yield_unit_conversions(unit: str, value: float, expected: float) -> None:
    assert normalize_value("yield", unit, value) == pytest.approx(expected)


def test_unknown_units_and_negative_values_are_rejected() -> None:
    with pytest.raises(ValueError):
        normalize_value("production", "kg", 1000)
    with pytest.raises(ValueError):
        normalize_value("yield", "kg/ha", -1)


def test_regional_and_china_aggregate_excluded_from_country_crosswalk() -> None:
    assert country_for_m49("'5000") is None
    assert country_for_m49("'159") is None
    china = country_for_m49("'156")
    uk = country_for_m49("'826")
    assert china is not None and china.alpha_3 == "CHN"
    assert uk is not None and uk.alpha_3 == "GBR"


def test_live_snapshot_has_consistent_units_and_unique_keys() -> None:
    root = Path(__file__).resolve().parents[1]
    name = json.loads((root / "data/latest.json").read_text())["vintage"]
    frame = pl.read_parquet(root / "data/vintages" / name / "production.parquet")
    assert not frame.select("unique_id", "ds").is_duplicated().any()
    assert frame["geography_id"].str.len_chars().eq(3).all()
    assert frame.filter(pl.col("metric") == "yield")["unit"].unique().to_list() == [
        "tonne / hectare"
    ]
    assert frame.filter(pl.col("metric") == "production")["unit"].unique().to_list() == ["tonne"]
    assert (frame["y"] >= 0).all()
    joined = (
        frame.filter(pl.col("metric") == "production")
        .select("geography_id", "commodity_id", "year", pl.col("y").alias("production"))
        .join(
            frame.filter(pl.col("metric") == "area").select(
                "geography_id", "commodity_id", "year", pl.col("y").alias("area")
            ),
            on=["geography_id", "commodity_id", "year"],
        )
        .join(
            frame.filter(pl.col("metric") == "yield").select(
                "geography_id", "commodity_id", "year", pl.col("y").alias("yield")
            ),
            on=["geography_id", "commodity_id", "year"],
        )
        .filter((pl.col("area") > 100) & (pl.col("production") > 100))
    )
    # Provider series can differ through rounding. Check that unit conversion is of the right order.
    ratio = joined["yield"] / (joined["production"] / joined["area"])
    assert ratio.median() == pytest.approx(1, rel=0.02)


def test_fresh_runner_preserves_first_seen_and_restores_raw_archive(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(pipeline, "ROOT", tmp_path)
    monkeypatch.setattr(pipeline, "DATA", tmp_path / "data")
    raw = tmp_path / "data" / "raw"
    raw.mkdir(parents=True)
    source = raw / "worldbank.xlsx"
    source.write_bytes(b"unchanged provider release")
    config = {
        "name": "World Bank",
        "source_url": "https://example.com/dataset",
        "license": "Provider terms",
    }
    original = pipeline.record_release(
        "worldbank", source, "https://example.com/data.xlsx", "2026-09-01", config
    )
    snapshot = tmp_path / "data" / "vintages" / "2026-09-01" / "metadata.json"
    pipeline.write_json(snapshot, {"releases": {"worldbank": original}})
    for artifact in raw.iterdir():
        if artifact != source:
            artifact.unlink()
    later = source.stat().st_mtime + 86400
    os.utime(source, (later, later))
    restored = pipeline.record_release(
        "worldbank", source, "https://example.com/data.xlsx", "2026-09-01", config
    )
    assert restored["first_seen_at"] == original["first_seen_at"]
    assert restored["provider_release_id"] == original["provider_release_id"]
    assert (tmp_path / restored["raw_path"]).read_bytes() == source.read_bytes()
