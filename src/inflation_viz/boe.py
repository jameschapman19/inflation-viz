"""Fetcher for the Bank of England's Interactive Database (IADB) — a
different provider from every other series in this pipeline, with a
completely different API shape, so it gets its own small module rather
than living in `fetch.py`.

The IADB has no per-series JSON endpoint like ONS does; instead one query
endpoint takes a comma-separated list of series codes and a date range and
returns CSV. A `CSVF=TN` ("tabular, no titles" — despite the name, the
first row *is* a header) request for one series looks like::

    DATE,IUDBEDR
    04 Jan 1975,11.50
    05 Jan 1975,11.50
    ...

One row per calendar day the series has a value for (Bank Rate is held
constant between MPC decisions, so most rows repeat the previous value —
this pipeline stores it as-is rather than collapsing it to just the days
it changed, same "don't reshape what the source gives you" approach as
every ONS series here).

Unlike ONS's timeseries API, which always returns full history regardless
of when you ask, the IADB requires an explicit end date on every request —
so, unlike `SeriesSource.api_url` elsewhere in this pipeline, the date
range here is built fresh at fetch time rather than baked into a static
URL (see `config.py`'s `load_boe` docstring).
"""

from __future__ import annotations

import csv
import io
from datetime import UTC, datetime

import polars as pl
import requests

from inflation_viz.config import BOE_IADB_QUERY_URL, SeriesSource
from inflation_viz.storage import ProvenanceRecord

# Bank Rate's IADB series starts in 1975; requesting from well before any
# BoE series here actually starts is harmless — the response just contains
# whatever data really exists from that point on.
_DATE_FROM = "01/Jan/1975"

# requests' default User-Agent ("python-requests/X.Y") gets a flat 403 from
# the IADB (confirmed via a live CI run: every ONS request in the same run
# succeeded with the same default UA, only this endpoint rejected it) — a
# descriptive one identifying this project, rather than spoofing a browser,
# is the more honest fix to try first.
_HEADERS = {"User-Agent": "inflation-viz/1.0 (+https://github.com/jameschapman19/inflation-viz)"}


def parse_iadb_csv(unique_id: str, csv_text: str) -> pl.DataFrame:
    """Parses a `CSVF=TN` single-series response into unique_id/ds/y rows.

    Raises ValueError on a header/shape that doesn't match what a
    single-series `TN` request returns — fail loudly rather than silently
    returning an empty series, same as `fetch.py`'s `parse_ons_response`.
    """
    reader = csv.reader(io.StringIO(csv_text))
    header = next(reader, None)
    if header is None or len(header) != 2 or header[0] != "DATE":
        raise ValueError(f"{unique_id}: unexpected BoE IADB CSV header {header!r}")

    rows = [
        {
            "unique_id": unique_id,
            "ds": datetime.strptime(row[0], "%d %b %Y").date(),
            "y": float(row[1]),
        }
        for row in reader
        if row and row[0]
    ]
    if not rows:
        raise ValueError(f"{unique_id}: BoE IADB CSV had a header but no data rows")
    return pl.DataFrame(rows, schema={"unique_id": pl.Utf8, "ds": pl.Date, "y": pl.Float64})


def fetch_boe_series(
    source: SeriesSource, session: requests.Session, *, fetched_at: datetime
) -> tuple[pl.DataFrame, ProvenanceRecord]:
    params = {
        "csv.x": "yes",
        "Datefrom": _DATE_FROM,
        "Dateto": fetched_at.strftime("%d/%b/%Y"),
        "SeriesCodes": source.cdid,
        "CSVF": "TN",
        "UsingCodes": "Y",
        "VPD": "Y",
        "VFD": "N",
    }
    response = session.get(BOE_IADB_QUERY_URL, params=params, headers=_HEADERS, timeout=30)
    response.raise_for_status()

    series_df = parse_iadb_csv(source.unique_id, response.text)

    provenance = ProvenanceRecord(
        unique_id=source.unique_id,
        source_name=source.source_name,
        source_url=source.source_url,
        cdid=source.cdid,
        license=source.license,
        # The IADB response carries no release-date field the way ONS's
        # JSON does (a "description.releaseDate") — fetch time is the best
        # available stand-in, same fallback fetch.py uses when ONS omits it.
        release_date=fetched_at,
        fetched_at=fetched_at,
    )
    return series_df, provenance


def main() -> None:
    """Manual sanity check against the live IADB — not run by tests or the
    scheduled refresh (see `fetch.py`'s `fetch_all`, which calls
    `fetch_boe_series` directly for every `registry.boe` entry).
    """
    from inflation_viz.config import load_boe
    from inflation_viz.http import new_session

    with new_session() as session:
        for source in load_boe().values():
            df, provenance = fetch_boe_series(source, session, fetched_at=datetime.now(UTC))
            print(
                f"{source.unique_id} ({provenance.cdid}): {df.shape[0]} rows, latest {df.tail(1)}"
            )


if __name__ == "__main__":
    main()
