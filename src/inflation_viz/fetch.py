"""sources.yaml-driven fetcher for the ONS timeseries API.

Every series pulled here comes from `sources.yaml` — there is no
series-specific fetch logic. Each series's `api_url` is called as-is; the
response shape is ONS's standard timeseries JSON
(https://api.ons.gov.uk/timeseries/{cdid}/dataset/{dataset}/data):

    {
      "months": [{"date": "2023 NOV", "value": "3.9"}, ...],
      "description": {"cdid": "D7G7", "releaseDate": "2024-01-17T09:30:00.000Z", ...}
    }

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

from inflation_viz.config import SeriesSource, SourceRegistry, load_registry
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


def _parse_month(raw: str) -> date:
    """Parse ONS's "YYYY MON" month label into the first of that month."""
    year_str, mon_str = raw.split()
    return date(int(year_str), _MONTH_ABBR[mon_str.upper()], 1)


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

    Raises KeyError/ValueError on an unexpected shape — fail loudly rather
    than silently skipping a series (a wrong CDID pulling a subtly wrong
    series is exactly the failure mode this pipeline needs to surface).
    """
    months = payload["months"]
    assert isinstance(months, list)
    rows = [
        {
            "unique_id": unique_id,
            "ds": _parse_month(str(m["date"])),
            "y": float(str(m["value"])),
        }
        for m in months
    ]
    return pl.DataFrame(rows, schema={"unique_id": pl.Utf8, "ds": pl.Date, "y": pl.Float64})


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
    """Fetch every series in the registry and write a new vintage snapshot.

    Returns the new vintage directory so a caller (e.g. refresh.py) can
    attach the basket weights snapshot to the same vintage.
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
    registry = load_registry()
    fetch_all(registry)


if __name__ == "__main__":
    main()
