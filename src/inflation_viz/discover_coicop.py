"""One-off developer tool: downloads ONS's full mm23 bulk dataset and
extracts every CDID whose title names a COICOP code, pairing up each
code's ANNUAL RATE and WEIGHTS series.

This is not part of the regular pipeline (refresh.py never imports it) —
it exists to replace hundreds of individual "does ONS publish a rate/weight
for 07.2.2.2?" web searches with one authoritative pass over ONS's own
series list, so sources.yaml's `subdivisions:`/`subdivision_weights:` can
be filled in mechanically instead of guessed. Every code+CDID this script
finds comes directly from an ONS-published title string; nothing here is
inferred or pattern-guessed the way an ambiguous web search result might
be, so downstream code can treat this output as ground truth in the same
sense as everything else in sources.yaml.

This sandbox's network egress policy blocks ons.gov.uk directly, so this
script is meant to run on GitHub Actions (unrestricted internet), the same
place refresh.py's actual ONS fetches run —
`uv run python -m inflation_viz.discover_coicop`, triggered via the
`discover.yml` workflow.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
from pathlib import Path

import requests

from inflation_viz.config import REPO_ROOT

DATASET_PAGE = (
    "https://www.ons.gov.uk/economy/inflationandpriceindices/datasets/consumerpriceindices/current"
)
DEFAULT_OUT_PATH = REPO_ROOT / "data" / "ons_coicop_reference.json"

# ONS titles look like "CPI ANNUAL RATE 07.2.2 : FUELS & LUBRICANTS 2015=100"
# or "CPI WEIGHTS 08.2-3 Telephone and telefax equipment and services" (no
# colon) or "CPI WEIGHTS 02.2.0.1 Cigarettes" (5-digit subclass, no colon).
# The code can use "." or "-" or "/" as a group separator (e.g. "05.3.1/2",
# "08.2-3") — COICOP itself only ever uses ".", but ONS's own titles use
# "/" and "-" for its own combined/collapsed series, so both must be
# captured to identify those cases rather than silently dropping them.
_TITLE_RE = re.compile(
    r"^CPI\s+(ANNUAL RATE|WEIGHTS)\s+(\d{2}(?:[./-]\d+){0,4})\s*:?\s*(.+?)(?:\s+2015=100)?$",
    re.IGNORECASE,
)


def _find_bulk_csv_url(session: requests.Session) -> str:
    """The dataset landing page links to the current bulk CSV; scrape that
    link instead of hardcoding it, since ONS revisions the URL (.../v24/,
    .../v25/, ...) each time the dataset updates.
    """
    response = session.get(DATASET_PAGE, timeout=30)
    response.raise_for_status()
    match = re.search(r'href="([^"]+mm23\.csv[^"]*)"', response.text, re.IGNORECASE)
    if not match:
        raise ValueError(f"Could not find a mm23.csv download link on {DATASET_PAGE}")
    href = match.group(1)
    return href if href.startswith("http") else f"https://www.ons.gov.uk{href}"


def _parse_bulk_csv(csv_text: str) -> dict[str, str]:
    """ONS's bulk time-series CSVs are transposed: each column is one
    series, and the first several rows carry that series' metadata (one
    row labelled "Title" in the first cell, one labelled "CDID", etc.)
    before the data rows begin. Returns {cdid: title}.
    """
    reader = csv.reader(io.StringIO(csv_text))
    title_row: list[str] | None = None
    cdid_row: list[str] | None = None
    for row in reader:
        if not row:
            continue
        label = row[0].strip().lower()
        if label == "title":
            title_row = row
        elif label == "cdid":
            cdid_row = row
        if title_row is not None and cdid_row is not None:
            break

    if title_row is None or cdid_row is None:
        raise ValueError('Could not find both a "Title" row and a "CDID" row in the bulk CSV')

    return {
        cdid.strip(): title.strip()
        for cdid, title in zip(cdid_row[1:], title_row[1:], strict=False)
        if cdid.strip() and title.strip()
    }


def _extract_coicop_series(titles_by_cdid: dict[str, str]) -> dict[str, dict[str, object]]:
    """Groups every CPI ANNUAL RATE / CPI WEIGHTS series by its COICOP
    code. Returns {code: {"rate_cdid": ..., "weight_cdid": ..., "name": ...}}
    — either cdid key is absent if ONS doesn't publish that measure for
    the code, exactly mirroring how sources.yaml already treats a
    one-sided pair (e.g. a rate with no matching weight) as "not
    confirmed, don't include" rather than guessing the other half.
    """
    by_code: dict[str, dict[str, object]] = {}
    for cdid, title in titles_by_cdid.items():
        match = _TITLE_RE.match(title)
        if not match:
            continue
        metric, code, name = match.groups()
        entry = by_code.setdefault(code, {"name": name.strip()})
        if metric.upper() == "ANNUAL RATE":
            entry["rate_cdid"] = cdid
        else:
            entry["weight_cdid"] = cdid
    return by_code


def discover(session: requests.Session | None = None) -> dict[str, dict[str, object]]:
    owns_session = session is None
    session = session or requests.Session()
    try:
        csv_url = _find_bulk_csv_url(session)
        response = session.get(csv_url, timeout=120)
        response.raise_for_status()
        titles_by_cdid = _parse_bulk_csv(response.text)
        return _extract_coicop_series(titles_by_cdid)
    finally:
        if owns_session:
            session.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_PATH)
    args = parser.parse_args()

    by_code = discover()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(by_code, indent=2, sort_keys=True), encoding="utf-8")
    both = sum(1 for v in by_code.values() if "rate_cdid" in v and "weight_cdid" in v)
    print(f"{len(by_code)} COICOP codes found ({both} with both rate and weight) -> {args.out}")


if __name__ == "__main__":
    main()
