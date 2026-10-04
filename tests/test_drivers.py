import json
from datetime import UTC, date, datetime
from pathlib import Path

import polars as pl
import pytest
import responses

from inflation_viz import drivers
from inflation_viz.ons_catalog import build_catalog

FETCHED = datetime(2026, 10, 4, 12, tzinfo=UTC)
CSV = (
    "Date,ULSP (Ultra low sulphur unleaded petrol) Pump price in pence/litre,"
    "ULSD (Ultra low sulphur diesel) Pump price in pence/litre\n"
    "21/09/2026,130.2,140.5\n28/09/2026,131.1,141.2\n"
)
CONTENT = {
    "details": {
        "change_history": [
            {
                "note": "Road fuel prices for week commencing Monday 28 September 2026 published.",
                "public_timestamp": "2026-09-29T08:30:06Z",
            }
        ]
    }
}


def fuel_frame() -> pl.DataFrame:
    return drivers.parse_fuel_csv(CSV, CONTENT, fetched_at=FETCHED, source_url=drivers.FUEL_PAGE)


def test_fuel_keeps_only_evidenced_publication_dates() -> None:
    frame = fuel_frame()
    assert frame.height == 4
    older = frame.filter(pl.col("ds") == date(2026, 9, 21))
    assert older["published_at"].null_count() == 2
    recent = frame.filter(pl.col("ds") == date(2026, 9, 28))
    assert recent["published_at"].to_list() == [datetime(2026, 9, 29, 8, 30, 6, tzinfo=UTC)] * 2
    assert frame["fetched_at"].to_list() == [FETCHED] * 4


@pytest.mark.parametrize("value", ["nan", "inf", "-1"])
def test_fuel_rejects_invalid_prices(value: str) -> None:
    with pytest.raises(ValueError, match="finite and nonnegative"):
        drivers.parse_fuel_csv(
            CSV.replace("130.2", value), CONTENT, fetched_at=FETCHED, source_url=drivers.FUEL_PAGE
        )


def test_fuel_schema_changes_fail_loudly() -> None:
    with pytest.raises(ValueError, match="columns"):
        drivers.parse_fuel_csv("Date,Price\n", {}, fetched_at=FETCHED, source_url=drivers.FUEL_PAGE)


def test_ofgem_preserves_two_announced_effective_periods() -> None:
    html = (Path(__file__).parent / "fixtures" / "ofgem_unit_rates.html").read_text()
    frame = drivers.parse_ofgem(html, fetched_at=FETCHED)
    assert frame.height == 8
    gas = frame.filter(pl.col("unique_id") == "GB.OFGEM.GAS.UNIT.DD")
    assert gas["y"].to_list() == [7.33, 7.97]
    assert gas["ds"].to_list() == [date(2026, 7, 1), date(2026, 10, 1)]
    assert gas["effective_end"].to_list() == [date(2026, 9, 30), date(2026, 12, 31)]
    assert frame["published_at"].null_count() == 8
    with pytest.raises(ValueError, match="heading"):
        drivers.parse_ofgem(html.replace("Direct Debit", "Standard Credit"), fetched_at=FETCHED)


def test_index_cdid_is_discovered_from_titles_without_changing_chart_registry() -> None:
    catalog = build_catalog({"D7DU": "CPI INDEX 04.5.2 : GAS 2015=100"})
    assert catalog[("CPI", "04.5.2")].index_cdid == "D7DU"
    assert catalog[("CPI", "04.5.2")].rate_cdid is None


def test_ons_retains_observation_update_time_and_missing_values() -> None:
    payload = {
        "months": [
            {"date": "2026 AUG", "value": "159.9", "updateDate": "2026-09-15T23:00:00.000Z"},
            {"date": "2026 SEP", "value": ""},
        ]
    }
    frame = drivers.parse_ons(
        "GB.INDEX.04.5.2",
        payload,
        fetched_at=FETCHED,
        source_url="https://www.ons.gov.uk",
        unit="index_2015_100",
    )
    assert frame.height == 1
    assert frame["published_at"][0] == datetime(2026, 9, 15, 23, tzinfo=UTC)


def test_snapshot_is_append_only_and_has_availability_manifest(tmp_path: Path) -> None:
    path = drivers.write_snapshot(fuel_frame(), fetched_at=FETCHED, data_dir=tmp_path)
    assert pl.read_parquet(path / "observations.parquet").equals(fuel_frame())
    assert json.loads((path / "manifest.json").read_text())["schemaVersion"] == 1
    with pytest.raises(FileExistsError):
        drivers.write_snapshot(fuel_frame(), fetched_at=FETCHED, data_dir=tmp_path)
    duplicate = pl.concat([fuel_frame(), fuel_frame()])
    with pytest.raises(ValueError, match="Duplicate"):
        drivers.write_snapshot(duplicate, fetched_at=FETCHED, data_dir=tmp_path)


@responses.activate
def test_outage_keeps_other_sources_and_records_failure(tmp_path: Path) -> None:
    responses.get(
        drivers.FUEL_API,
        json={
            "details": {
                "attachments": [
                    {"url": "https://example.com/fuel.csv", "content_type": "text/csv"},
                ]
            }
        },
        status=200,
    )
    responses.get("https://example.com/fuel.csv", body=CSV, status=200)
    responses.get(drivers.OFGEM_URL, status=503)
    path = drivers.refresh(data_dir=tmp_path, catalog={})
    manifest = json.loads((path / "manifest.json").read_text())
    assert set(manifest["errors"]) == {"ons", "ofgem"}
    assert manifest["series"] == ["GB.FUEL.DIESEL", "GB.FUEL.PETROL"]
