"""Registry-driven fetcher for ONS's timeseries JSON.

Every series pulled here comes from whatever `SourceRegistry` it's given —
in production that's `ons_catalog.discover_registry()`'s live result, not
anything hardcoded — there is no series-specific fetch logic. Each
series's `api_url` is called as-is; the
response is the same JSON that powers the chart on the series' own
www.ons.gov.uk page — append `/data` to the page URL
(https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/{cdid}/{dataset}/data):

    {
      "months": [{"date": "2023 NOV", "value": "3.9"}, ...],
      "description": {"cdid": "D7G7", "releaseDate": "2024-01-17T09:30:00.000Z", ...}
    }

Note this is *not* the old `api.ons.gov.uk` v0 API — that was fully
retired in November 2024 and has no direct replacement (ONS's guidance is
to resolve a series via the beta search API instead). The `www.ons.gov.uk/
.../data` endpoint above is the one that's actually still live; the first
version of this fetcher used the retired v0 host and 404'd in CI, which is
how this got caught.

Note for anyone running this: this pipeline's dev sandbox has ONS's domains
blocked by network egress policy, so it cannot be exercised against live
data here. It is written and tested against a fixture that mirrors the real
API response shape (tests/fixtures/ons_timeseries_response.json) and is
expected to run against live ONS data in CI, where GitHub-hosted runners
have unrestricted internet access.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from pathlib import Path

import polars as pl
import requests

from inflation_viz.config import SeriesSource, SourceRegistry
from inflation_viz.ons_catalog import discover_registry
from inflation_viz.storage import ProvenanceRecord, write_vintage

_MONTH_ABBR = {
    "JAN": 1,
    "FEB": 2,
    "MAR": 3,
    "APR": 4,
    "MAY": 5,
    "JUN": 6,
    "JUL": 7,
    "AUG": 8,
    "SEP": 9,
    "OCT": 10,
    "NOV": 11,
    "DEC": 12,
}


_QUARTER_START_MONTH = {"Q1": 1, "Q2": 4, "Q3": 7, "Q4": 10}


def _parse_month(raw: str) -> date:
    """Parse ONS's "YYYY MON" month label into the first of that month."""
    year_str, mon_str = raw.split()
    return date(int(year_str), _MONTH_ABBR[mon_str.upper()], 1)


def _parse_quarter(raw: str) -> date:
    """Parse ONS's "YYYY QN" quarter label into that quarter's first month."""
    year_str, q_str = raw.split()
    return date(int(year_str), _QUARTER_START_MONTH[q_str.upper()], 1)


def _parse_year(raw: str) -> date:
    """Parse ONS's "YYYY" year label into 1 January of that year."""
    return date(int(raw.strip()), 1, 1)


def _parse_release_date(raw: str) -> datetime:
    return datetime.strptime(raw, "%Y-%m-%dT%H:%M:%S.%f%z").astimezone(UTC)


def _parse_next_release(raw: str) -> datetime | None:
    """Best-effort parse of ONS's free-text "nextRelease" field (e.g. "17 December 2025").

    Returns None rather than raising — this is a display nicety, not
    load-bearing provenance, so an unrecognised format shouldn't fail the fetch.
    """
    for fmt in ("%d %B %Y", "%B %Y"):
        try:
            return datetime.strptime(raw.strip(), fmt).replace(tzinfo=UTC)
        except ValueError:
            continue
    return None


def parse_ons_response(unique_id: str, payload: dict[str, object]) -> pl.DataFrame:
    """Parse an ONS timeseries JSON payload into unique_id/ds/y rows.

    ONS's response always carries "months", "quarters", and "years" arrays,
    but only the one matching the series' actual publication frequency is
    populated — the other two are empty lists. Most series here are
    monthly, but the basket-weight CDIDs are annual (rebased each Jan/Feb
    and held constant the rest of the year), so this tries each in order
    and uses whichever one actually has rows.

    Raises ValueError if none of them do — fail loudly rather than
    silently returning an empty series (a wrong CDID pulling a subtly
    wrong series is exactly the failure mode this pipeline needs to surface).
    """
    for key, parse_date in (
        ("months", _parse_month),
        ("quarters", _parse_quarter),
        ("years", _parse_year),
    ):
        observations = payload.get(key)
        if not isinstance(observations, list) or not observations:
            continue
        rows = [
            {
                "unique_id": unique_id,
                "ds": parse_date(str(obs["date"])),
                "y": float(str(obs["value"])),
            }
            for obs in observations
        ]
        return pl.DataFrame(rows, schema={"unique_id": pl.Utf8, "ds": pl.Date, "y": pl.Float64})

    raise ValueError(
        f"{unique_id}: ONS response has no months, quarters, or years observations — "
        "unexpected shape, check the CDID."
    )


def fetch_series(
    source: SeriesSource, session: requests.Session, *, fetched_at: datetime
) -> tuple[pl.DataFrame, ProvenanceRecord]:
    response = session.get(source.api_url, timeout=30)
    response.raise_for_status()
    payload: dict[str, object] = response.json()

    series_df = parse_ons_response(source.unique_id, payload)

    description_raw = payload.get("description", {})
    description = description_raw if isinstance(description_raw, dict) else {}
    release_date_raw = description.get("releaseDate")
    release_date = _parse_release_date(str(release_date_raw)) if release_date_raw else fetched_at
    next_release_raw = description.get("nextRelease")
    next_release = _parse_next_release(str(next_release_raw)) if next_release_raw else None

    provenance = ProvenanceRecord(
        unique_id=source.unique_id,
        source_name=source.source_name,
        source_url=source.source_url,
        cdid=source.cdid,
        license=source.license,
        release_date=release_date,
        fetched_at=fetched_at,
        next_release_date=next_release,
    )
    return series_df, provenance


def fetch_all(registry: SourceRegistry, session: requests.Session | None = None) -> Path:
    """Fetch every series in the registry (headline, divisions, and basket
    weights alike) and write a new vintage snapshot. Returns the new vintage
    directory.
    """
    owns_session = session is None
    session = session or requests.Session()
    fetched_at = datetime.now(UTC)

    frames: list[pl.DataFrame] = []
    provenance: list[ProvenanceRecord] = []
    try:
        for source in registry.all_series.values():
            series_df, prov = fetch_series(source, session, fetched_at=fetched_at)
            frames.append(series_df)
            provenance.append(prov)
    finally:
        if owns_session:
            session.close()

    combined = pl.concat(frames)
    return write_vintage(combined, provenance, fetched_at=fetched_at)


def main() -> None:
    registry = discover_registry()
    fetch_all(registry)


if __name__ == "__main__":
    main()
