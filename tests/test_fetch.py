import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
import requests
import responses

from inflation_viz.config import SeriesSource
from inflation_viz.fetch import fetch_series, parse_ons_response

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "ons_timeseries_response.json"


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

    with requests.Session() as session, pytest.raises(KeyError):
        fetch_series(sample_source, session, fetched_at=datetime(2024, 4, 20, tzinfo=UTC))
