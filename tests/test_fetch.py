import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
import requests
import responses

from inflation_viz.config import BOE_IADB_QUERY_URL, SeriesSource, SourceRegistry
from inflation_viz.fetch import fetch_all, fetch_series, parse_ons_response
from inflation_viz.storage import read_latest_series

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "ons_timeseries_response.json"
WEIGHTS_FIXTURE_PATH = Path(__file__).parent / "fixtures" / "ons_weights_response.json"


@pytest.fixture
def sample_source() -> SeriesSource:
    return SeriesSource(
        unique_id="GB.CPI",
        name="CPI: All items 12-month rate",
        cdid="D7G7",
        dataset="mm23",
        source_name="Office for National Statistics",
        source_url="https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23",
        api_url="https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23/data",
        license="Open Government Licence v3.0",
        cadence="monthly",
        unit="percent",
    )


def test_parse_ons_response_produces_expected_rows() -> None:
    payload = json.loads(FIXTURE_PATH.read_text())
    df = parse_ons_response("GB.CPI", payload)

    assert df.shape == (3, 3)
    assert df["unique_id"].to_list() == ["GB.CPI", "GB.CPI", "GB.CPI"]
    assert df["y"].to_list() == [4.0, 3.4, 3.2]
    assert str(df["ds"].to_list()[0]) == "2024-01-01"


def test_parse_ons_response_falls_back_to_years_for_annual_series() -> None:
    """The basket-weight CDIDs are annual — their "months" array is empty
    and the observations live under "years" instead. Regression test for
    the bug where this silently produced a zero-row series.
    """
    payload = json.loads(WEIGHTS_FIXTURE_PATH.read_text())
    df = parse_ons_response("GB.W01", payload)

    assert df.shape == (3, 3)
    assert df["y"].to_list() == [104.5, 106.2, 107.8]
    assert [str(d) for d in df["ds"].to_list()] == ["2024-01-01", "2025-01-01", "2026-01-01"]


def test_parse_ons_response_raises_when_no_observations_present() -> None:
    with pytest.raises(ValueError, match="no months, quarters, or years"):
        parse_ons_response("GB.CPI", {"months": [], "quarters": [], "years": []})


@responses.activate
def test_fetch_series_returns_data_and_provenance(sample_source: SeriesSource) -> None:
    payload = json.loads(FIXTURE_PATH.read_text())
    responses.add(responses.GET, sample_source.api_url, json=payload, status=200)

    with requests.Session() as session:
        series_df, provenance = fetch_series(
            sample_source, session, fetched_at=datetime(2024, 4, 20, tzinfo=UTC)
        )

    assert series_df.shape == (3, 3)
    assert provenance.unique_id == "GB.CPI"
    assert provenance.cdid == "D7G7"
    assert provenance.source_url == sample_source.source_url
    assert provenance.license == "Open Government Licence v3.0"
    assert provenance.release_date == datetime(2024, 4, 17, 9, 30, tzinfo=UTC)
    assert provenance.next_release_date == datetime(2024, 5, 22, tzinfo=UTC)
    assert provenance.fetched_at == datetime(2024, 4, 20, tzinfo=UTC)


@responses.activate
def test_fetch_series_raises_loudly_on_malformed_payload(sample_source: SeriesSource) -> None:
    responses.add(responses.GET, sample_source.api_url, json={"unexpected": "shape"}, status=200)

    with requests.Session() as session, pytest.raises(ValueError, match="no months, quarters"):
        fetch_series(sample_source, session, fetched_at=datetime(2024, 4, 20, tzinfo=UTC))


@responses.activate
def test_fetch_all_still_writes_a_vintage_when_boe_fails(
    sample_source: SeriesSource, tmp_path: Path
) -> None:
    """Regression test for the 2026-09-01 incident: a live refresh run hit
    a 403 from the Bank of England on its very last request (Bank Rate),
    after every ONS series had already fetched successfully — and because
    the whole run raised before `write_vintage` was ever called, an
    entire day's worth of otherwise-good CPI/CPIH/RPI/wage-growth data
    was silently thrown away rather than committed. `fetch_all` must
    treat a `registry.boe` failure as skippable, not fatal to the run.
    """
    boe_source = SeriesSource(
        unique_id="GB.BOE.RATE",
        name="Bank Rate",
        cdid="IUDBEDR",
        dataset="iadb",
        source_name="Bank of England",
        source_url="https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp",
        api_url=BOE_IADB_QUERY_URL,
        license="Bank of England (see the Database's own terms of use)",
        cadence="daily",
        unit="percent",
    )
    registry = SourceRegistry(
        headline={"GB.CPI": sample_source},
        divisions={},
        weights={},
        subdivisions={},
        subdivision_weights={},
        external={},
        boe={"GB.BOE.RATE": boe_source},
    )
    responses.add(
        responses.GET, sample_source.api_url, json=json.loads(FIXTURE_PATH.read_text()), status=200
    )
    responses.add(responses.GET, BOE_IADB_QUERY_URL, status=403)

    vintage_path = fetch_all(registry, request_delay_seconds=0, data_dir=tmp_path)

    assert vintage_path.exists()
    series = read_latest_series(tmp_path)
    assert set(series["unique_id"]) == {"GB.CPI"}
