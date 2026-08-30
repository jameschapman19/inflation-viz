"""Live ONS series discovery — the app's only source of which CDIDs to
fetch. Headline, per-division, and the full COICOP sub-division tree (to
whatever depth ONS itself publishes) are all discovered fresh from ONS's
bulk mm23 dataset every refresh, by parsing ONS's own series titles. If
ONS adds, retires, or renames a series, the next refresh picks it up with
no code change.

Three title families matter here, all for the "CPI"/"CPIH" 2015=100 index:

  "CPI ANNUAL RATE 01.1 : FOOD 2015=100"           -> a 12-month rate (%)
  "CPI WEIGHTS 01.1 : FOOD"                        -> a basket weight (‰)
  "CPI: Contribution to all items annual rate: Food & non-alcoholic beverages"
                                                    -> a ppt contribution to
                                                       the headline rate

The first two carry the COICOP code directly. The third (published only
at the 12 divisions) carries no code at all, and its category names turn
out *not* to be a punctuation/case variant of the other two families'
names — e.g. WUMD is "Housing & household services" here vs "Housing,
water and fuels" in its own WEIGHTS title, for the same division. Since
that ruled out joining it dynamically, `_CONTRIBUTION_CODE_BY_NAME`
resolves it via an explicit table of the 12 divisions' own contribution
names, each confirmed directly against its ONS timeseries page — the same
evidentiary bar as any other series here, just verified once for a
closed, decades-stable set instead of rediscovered every refresh.

`discover_registry()` needs network access to ons.gov.uk; everything else
here — parsing, classification, name-joining — is pure and covered by
tests/test_ons_catalog.py against a local fixture.
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass

import requests

from inflation_viz.config import ReferenceTableSource, SeriesSource, SourceRegistry, load_external
from inflation_viz.http import new_session

DATASET_PAGE = (
    "https://www.ons.gov.uk/economy/inflationandpriceindices/datasets/consumerpriceindices/current"
)

_DATASET = "mm23"
_SOURCE_NAME = "Office for National Statistics"
_LICENSE = "Open Government Licence v3.0"
_CADENCE = "monthly"

# "CPI ANNUAL RATE 01.1 : FOOD 2015=100" / "CPI WEIGHTS 01.1 : FOOD" (no
# suffix) / "CPIH ANNUAL RATE 04.2 : ..." — the code itself uses "." between
# COICOP levels; ONS's own combined/collapsed series (a group or class ONS
# doesn't split further) use "-" or "/" within the trailing segment (e.g.
# "08.2-3", "05.3.1/2") rather than a guessed split of its own.
_RATE_WEIGHT_RE = re.compile(
    r"^CPI(H)?\s+(ANNUAL RATE|WEIGHTS)\s+(\d{2}(?:[./-]\d+){0,4})\s*:?\s*(.+?)(?:\s+2015=100)?$",
    re.IGNORECASE,
)

# "CPI: Contribution to all items annual rate: Food & non-alcoholic beverages"
_CONTRIBUTION_RE = re.compile(
    r"^CPI(H)?:\s*Contribution to all items annual rate:\s*(.+)$",
    re.IGNORECASE,
)

# Each name below is the exact category label ONS uses on the CPI
# "Contribution to all items annual rate" series for that division —
# confirmed against the series' own ons.gov.uk/.../timeseries/{cdid} page
# (01=WUMA, 02=WUMB, 03=WUMC, 04=WUMD, 05=WUMP, 06=WUMQ, 07=WUMW, 08=WUMX,
# 09=WUNC, 10=WUND, 11=WUNE, 12=WUNG). CPIH publishes a parallel set of
# these under different CDIDs (e.g. L5H8) with unconfirmed naming, so only
# CPI's is resolved — nothing downstream uses a CPIH division anyway.
_CONTRIBUTION_NAMES_BY_CODE = {
    "01": "Food & non-alcoholic beverages",
    "02": "Alcohol & tobacco",
    "03": "Clothing & footwear",
    "04": "Housing & household services",
    "05": "Furniture & household goods",
    "06": "Health",
    "07": "Transport",
    "08": "Communication",
    "09": "Recreation & culture",
    "10": "Education",
    "11": "Restaurants & hotels",
    "12": "Misc goods & services",
}


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


def parse_bulk_csv(csv_text: str) -> dict[str, str]:
    """ONS's bulk time-series CSVs are transposed: each column is one
    series, and several metadata rows (one labelled "Title" in the first
    cell, one labelled "CDID", etc.) precede the data rows. Returns
    {cdid: title}.
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


def _titleize(raw: str) -> str:
    """ONS's titles are ALL CAPS; every hand-written name in this project's
    history has been sentence case ("Non-alcoholic beverages", "Mineral
    waters, soft drinks and juices") — this is cosmetic display formatting
    only, never load-bearing: the code/CDID pairing never depends on it.
    """
    text = raw.replace("&", "and").strip().lower()
    return text[:1].upper() + text[1:] if text else text


def _normalize_name(raw: str) -> str:
    """Case/punctuation-insensitive key, so a contribution title's name
    matches `_CONTRIBUTION_NAMES_BY_CODE` regardless of "&" vs "and" or
    stray punctuation.
    """
    text = raw.lower().replace("&", " and ")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text).split())


_CONTRIBUTION_CODE_BY_NAME = {
    _normalize_name(name): code for code, name in _CONTRIBUTION_NAMES_BY_CODE.items()
}


def _parent_coicop(code: str) -> str | None:
    """The parent is always the code with its last "." segment dropped —
    true regardless of what separator ("-" or "/") ONS uses *within* that
    trailing segment for its own combined series, since COICOP's "."
    boundaries are exactly the hierarchy depth. A 2-digit division code has
    no parent.
    """
    if "." not in code:
        return None
    return code.rsplit(".", 1)[0]


@dataclass
class CatalogEntry:
    name: str
    rate_cdid: str | None = None
    weight_cdid: str | None = None
    contribution_cdid: str | None = None


Catalog = dict[tuple[str, str], CatalogEntry]


def build_catalog(titles_by_cdid: dict[str, str]) -> Catalog:
    """Classifies every CDID's title into the COICOP code it belongs to.
    Ground truth throughout: every rate/weight code+CDID pairing comes
    directly from an ONS-published title string; every contribution
    code+CDID pairing comes from matching its title's category name
    against `_CONTRIBUTION_NAMES_BY_CODE` (see its comment) — an
    unrecognised name is dropped rather than guessed.
    """
    catalog: Catalog = {}

    for cdid, title in titles_by_cdid.items():
        rate_weight_match = _RATE_WEIGHT_RE.match(title)
        if rate_weight_match is not None:
            is_cpih, metric, code, name = rate_weight_match.groups()
            index_type = "CPIH" if is_cpih else "CPI"
            entry = catalog.setdefault((index_type, code), CatalogEntry(name=name.strip()))
            if metric.upper() == "ANNUAL RATE":
                entry.rate_cdid = cdid
            else:
                entry.weight_cdid = cdid
            continue

        contribution_match = _CONTRIBUTION_RE.match(title)
        if contribution_match is not None:
            is_cpih, name = contribution_match.groups()
            if is_cpih:
                continue
            code = _CONTRIBUTION_CODE_BY_NAME.get(_normalize_name(name))
            if code is None:
                continue
            entry = catalog.setdefault(("CPI", code), CatalogEntry(name=name.strip()))
            entry.contribution_cdid = cdid

    return catalog


def _series_source(
    *,
    unique_id: str,
    cdid: str,
    name: str,
    unit: str,
    coicop: str | None = None,
    parent_coicop: str | None = None,
    division_name: str | None = None,
) -> SeriesSource:
    cdid_lower = cdid.lower()
    source_url = f"https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/{cdid_lower}/{_DATASET}"
    return SeriesSource(
        unique_id=unique_id,
        name=name,
        cdid=cdid,
        dataset=_DATASET,
        source_name=_SOURCE_NAME,
        source_url=source_url,
        api_url=f"{source_url}/data",
        license=_LICENSE,
        cadence=_CADENCE,
        unit=unit,
        division_name=division_name,
        coicop=coicop,
        parent_coicop=parent_coicop,
    )


def build_registry(catalog: Catalog, external: dict[str, ReferenceTableSource]) -> SourceRegistry:
    """Classifies a discovered catalog into the registry's five ONS-series
    sections, purely by COICOP code depth — "00" is the headline, a
    2-digit code is a division, anything with a "." is a sub-division —
    plus whatever external (non-ONS-timeseries) sources are configured.
    """
    headline: dict[str, SeriesSource] = {}
    divisions: dict[str, SeriesSource] = {}
    weights: dict[str, SeriesSource] = {}
    subdivisions: dict[str, SeriesSource] = {}
    subdivision_weights: dict[str, SeriesSource] = {}

    for index_type in ("CPI", "CPIH"):
        entry = catalog.get((index_type, "00"))
        if entry is not None and entry.rate_cdid is not None:
            uid = f"GB.{index_type}"
            headline[uid] = _series_source(
                unique_id=uid,
                cdid=entry.rate_cdid,
                name=f"{index_type}: All items 12-month rate",
                unit="percent",
            )

    for (index_type, code), entry in catalog.items():
        if index_type != "CPI" or code == "00":
            continue
        display_name = _titleize(entry.name)
        is_division = "." not in code
        parent = None if is_division else _parent_coicop(code)

        # A division's primary measure is its ppt contribution to headline
        # CPI; a sub-division only has its own rate (ONS doesn't publish a
        # contribution measure below division level).
        primary_cdid = entry.contribution_cdid if is_division else entry.rate_cdid
        if primary_cdid is not None:
            uid = f"GB.CP{code}"
            (divisions if is_division else subdivisions)[uid] = _series_source(
                unique_id=uid,
                cdid=primary_cdid,
                name=display_name,
                coicop=code,
                parent_coicop=parent,
                division_name=display_name,
                unit="percentage_points" if is_division else "percent",
            )

        if entry.weight_cdid is not None:
            weight_uid = f"GB.{'W' if is_division else 'SW'}{code}"
            (weights if is_division else subdivision_weights)[weight_uid] = _series_source(
                unique_id=weight_uid,
                cdid=entry.weight_cdid,
                name=display_name,
                coicop=code,
                parent_coicop=parent,
                division_name=display_name,
                unit="per_mille",
            )

    return SourceRegistry(
        headline=headline,
        divisions=divisions,
        weights=weights,
        subdivisions=subdivisions,
        subdivision_weights=subdivision_weights,
        external=external,
    )


def discover_catalog(session: requests.Session | None = None) -> Catalog:
    """Network-touching: downloads ONS's current bulk mm23 CSV and builds
    the full catalog from it. See the module docstring for why this can
    only run where ons.gov.uk is reachable.
    """
    owns_session = session is None
    session = session or new_session()
    try:
        csv_url = _find_bulk_csv_url(session)
        response = session.get(csv_url, timeout=120)
        response.raise_for_status()
        titles_by_cdid = parse_bulk_csv(response.text)
        return build_catalog(titles_by_cdid)
    finally:
        if owns_session:
            session.close()


def discover_registry(
    session: requests.Session | None = None,
    external: dict[str, ReferenceTableSource] | None = None,
) -> SourceRegistry:
    """The pipeline's single entry point: a fresh, fully-live SourceRegistry
    with no hardcoded CDID anywhere upstream of ONS's own bulk dataset."""
    catalog = discover_catalog(session)
    return build_registry(catalog, external if external is not None else load_external())


def main() -> None:
    """Prints a discovery summary — useful for manually sanity-checking
    what ONS currently publishes (e.g. after ONS revises its bulk dataset)
    without running the full fetch+export pipeline.
    """
    registry = discover_registry()
    print(f"headline: {len(registry.headline)}")
    print(f"divisions: {len(registry.divisions)}  weights: {len(registry.weights)}")
    print(
        f"subdivisions: {len(registry.subdivisions)}  "
        f"subdivision_weights: {len(registry.subdivision_weights)}"
    )


if __name__ == "__main__":
    main()
