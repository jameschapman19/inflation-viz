from datetime import UTC, datetime

import pytest
import requests
import responses

from inflation_viz.boe import fetch_boe_series, parse_iadb_csv
from inflation_viz.config import BOE_IADB_QUERY_URL, SeriesSource

SAMPLE_CSV = "DATE,IUDBEDR\n04 Jan 2024,5.25\n01 Feb 2024,5.25\n21 Mar 2024,5.00\n"


@pytest.fixture
def sample_source() -> SeriesSource:
    return SeriesSource(
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


def test_parse_iadb_csv_produces_expected_rows() -> None:
    df = parse_iadb_csv("GB.BOE.RATE", SAMPLE_CSV)

    assert df.shape == (3, 3)
    assert df["unique_id"].to_list() == ["GB.BOE.RATE"] * 3
    assert df["y"].to_list() == [5.25, 5.25, 5.00]
    assert [str(d) for d in df["ds"].to_list()] == ["2024-01-04", "2024-02-01", "2024-03-21"]


def test_parse_iadb_csv_raises_on_unexpected_header() -> None:
    with pytest.raises(ValueError, match="unexpected BoE IADB CSV header"):
        parse_iadb_csv("GB.BOE.RATE", "SOMETHING,ELSE\n1,2\n")


def test_parse_iadb_csv_raises_when_no_data_rows_present() -> None:
    with pytest.raises(ValueError, match="had a header but no data rows"):
        parse_iadb_csv("GB.BOE.RATE", "DATE,IUDBEDR\n")


@responses.activate
def test_fetch_boe_series_returns_data_and_provenance(sample_source: SeriesSource) -> None:
    responses.add(responses.GET, BOE_IADB_QUERY_URL, body=SAMPLE_CSV, status=200)

    with requests.Session() as session:
        series_df, provenance = fetch_boe_series(
            sample_source, session, fetched_at=datetime(2024, 4, 20, tzinfo=UTC)
        )

    assert series_df.shape == (3, 3)
    assert provenance.unique_id == "GB.BOE.RATE"
    assert provenance.cdid == "IUDBEDR"
    assert provenance.source_url == sample_source.source_url
    assert provenance.fetched_at == datetime(2024, 4, 20, tzinfo=UTC)

    # api_url alone isn't the full request (unlike every ONS SeriesSource)
    # — Dateto is a fixed "now" per the IADB's own documented keyword,
    # not built from fetched_at (see boe.py's module docstring for why).
    request_url = responses.calls[0].request.url
    assert request_url is not None
    assert "SeriesCodes=IUDBEDR" in request_url
    assert "Dateto=now" in request_url


@responses.activate
def test_fetch_boe_series_raises_loudly_on_malformed_csv(sample_source: SeriesSource) -> None:
    responses.add(responses.GET, BOE_IADB_QUERY_URL, body="not,a,valid,shape\n", status=200)

    with requests.Session() as session, pytest.raises(ValueError, match="unexpected BoE IADB"):
        fetch_boe_series(sample_source, session, fetched_at=datetime(2024, 4, 20, tzinfo=UTC))
