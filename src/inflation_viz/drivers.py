"""Published energy/fuel observations with immutable retrieval-time revisions.

Publication time describes a release, not the availability of this revision.
Consumers must also respect fetched_at and the containing snapshot timestamp.
Historical publication dates are never inferred from a weekly cadence.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import logging
import math
import re
from datetime import UTC, date, datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, cast

import polars as pl
import requests

from inflation_viz.http import new_session
from inflation_viz.ons_catalog import Catalog, discover_catalog
from inflation_viz.storage import DATA_DIR, vintage_dir_name

FUEL_API = "https://www.gov.uk/api/content/government/statistics/weekly-road-fuel-prices"
FUEL_PAGE = "https://www.gov.uk/government/statistics/weekly-road-fuel-prices"
OFGEM_URL = (
    "https://www.ofgem.gov.uk/your-energy-supply/your-energy-bill/"
    "energy-price-cap-unit-rates-and-standing-charges"
)
OGL = "Open Government Licence v3.0"
SCHEMA = pl.Schema(
    {
        "unique_id": pl.String(),
        "ds": pl.Date(),
        "y": pl.Float64(),
        "effective_end": pl.Date(),
        "published_at": pl.Datetime("us", "UTC"),
        "fetched_at": pl.Datetime("us", "UTC"),
        "source_name": pl.String(),
        "source_url": pl.String(),
        "unit": pl.String(),
        "license": pl.String(),
        "publication_basis": pl.String(),
    }
)
INDEX_CODES = ("04.5.1", "04.5.2", "07.2.2")
LOGGER = logging.getLogger(__name__)


def timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Publication timestamps must include a timezone.")
    return parsed.astimezone(UTC)


def _row(
    uid: str,
    ds: date,
    y: float,
    *,
    fetched_at: datetime,
    source: str,
    url: str,
    unit: str,
    published_at: datetime | None = None,
    effective_end: date | None = None,
    license_name: str = OGL,
    basis: str = "not supplied; first retrieval only",
) -> dict[str, Any]:
    return {
        "unique_id": uid,
        "ds": ds,
        "y": y,
        "effective_end": effective_end,
        "published_at": published_at,
        "fetched_at": fetched_at,
        "source_name": source,
        "source_url": url,
        "unit": unit,
        "license": license_name,
        "publication_basis": basis,
    }


def validate(frame: pl.DataFrame) -> pl.DataFrame:
    frame = frame.select(list(SCHEMA)).cast(SCHEMA)
    if frame.is_empty():
        raise ValueError("No driver observations fetched.")
    if frame.select(pl.struct("unique_id", "ds").is_duplicated().any()).item():
        raise ValueError("Duplicate driver observations.")
    for r in frame.iter_rows(named=True):
        if not all(r[k] is not None for k in SCHEMA if k not in {"published_at", "effective_end"}):
            raise ValueError("Missing driver value or provenance.")
        if not math.isfinite(r["y"]) or r["y"] < 0:
            raise ValueError("Driver values must be finite and nonnegative.")
        if r["published_at"] and r["published_at"] > r["fetched_at"]:
            raise ValueError("Publication cannot follow retrieval.")
        if r["effective_end"] and r["effective_end"] < r["ds"]:
            raise ValueError("Invalid effective period.")
        if r["effective_end"] is None and r["ds"] > r["fetched_at"].date():
            raise ValueError("Future observation without an effective period.")
    return frame.sort("unique_id", "ds")


def parse_fuel_csv(
    csv_text: str,
    content: dict[str, Any],
    *,
    fetched_at: datetime,
    source_url: str,
) -> pl.DataFrame:
    releases: dict[date, datetime] = {}
    for event in content.get("details", {}).get("change_history", []):
        match = re.search(
            r"(?:commencing|beginning) (?:Monday )?(\d{1,2} \w+ \d{4})", event["note"]
        )
        if match:
            week = datetime.strptime(match[1], "%d %B %Y").date()
            released = timestamp(event["public_timestamp"])
            releases[week] = min(releases.get(week, released), released)
    reader = csv.DictReader(io.StringIO(csv_text.lstrip("\ufeff")))
    fields = reader.fieldnames or []
    columns = {
        fuel: next((c for c in fields if c.startswith(prefix) and "Pump price" in c), None)
        for fuel, prefix in (("PETROL", "ULSP"), ("DIESEL", "ULSD"))
    }
    if "Date" not in fields or not all(columns.values()):
        raise ValueError("Unrecognized DESNZ CSV columns.")
    rows = []
    for item in reader:
        ds = datetime.strptime(item["Date"].strip(), "%d/%m/%Y").date()
        for fuel, column in columns.items():
            assert column is not None
            published = releases.get(ds)
            rows.append(
                _row(
                    f"GB.FUEL.{fuel}",
                    ds,
                    float(item[column]),
                    fetched_at=fetched_at,
                    source="Department for Energy Security and Net Zero",
                    url=source_url,
                    unit="pence_per_litre",
                    published_at=published,
                    basis="GOV.UK dated change note"
                    if published
                    else "not supplied; first retrieval only",
                )
            )
    return validate(pl.DataFrame(rows, schema=SCHEMA))


class _Tables(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.tables: list[list[list[str]]] = []
        self.table: list[list[str]] | None = None
        self.row: list[str] | None = None
        self.cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            self.table = []
        elif self.table is not None and tag == "tr":
            self.row = []
        elif self.row is not None and tag in {"th", "td"}:
            self.cell = []

    def handle_data(self, data: str) -> None:
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"th", "td"} and self.cell is not None and self.row is not None:
            self.row.append(" ".join(" ".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None and self.table is not None:
            self.table.append(self.row)
            self.row = None
        elif tag == "table" and self.table is not None:
            self.tables.append(self.table)
            self.table = None


def _period(text: str) -> tuple[date, date]:
    match = re.search(r"(\d{1,2}) (\w+)(?: (\d{4}))? to (\d{1,2}) (\w+) (\d{4})", text)
    if not match:
        raise ValueError("Unrecognized Ofgem effective period.")
    d1, m1, y1, d2, m2, y2 = match.groups()
    start = datetime.strptime(f"{d1} {m1} {y1 or y2}", "%d %B %Y").date()
    end = datetime.strptime(f"{d2} {m2} {y2}", "%d %B %Y").date()
    return start, end


def parse_ofgem(html: str, *, fetched_at: datetime) -> pl.DataFrame:
    # Require the heading that identifies the table's payment basis. Regional
    # tables and annual dual-fuel bills must never be mistaken for unit rates.
    heading = re.search(
        r"<h3[^>]*>\s*Average electricity and gas unit prices "
        r"and standing charges by Direct Debit\s*</h3>",
        html,
        re.IGNORECASE,
    )
    if not heading:
        raise ValueError("Ofgem average Direct Debit table heading changed.")
    parser = _Tables()
    parser.feed(html[heading.end() :])
    if not parser.tables:
        raise ValueError("Ofgem unit rate table missing.")
    table = parser.tables[0]
    if len(table) != 3 or {r[0].upper() for r in table[1:]} != {"GAS", "ELECTRICITY"}:
        raise ValueError("Ofgem unit rate table shape changed.")
    periods = [_period(h) for h in table[0][1:]]
    rows = []
    for item in table[1:]:
        if len(item) != len(periods) + 1:
            raise ValueError("Ofgem table cells do not match periods.")
        for (start, end), cell in zip(periods, item[1:], strict=True):
            unit = re.search(r"([\d.]+) pence per kWh", cell)
            standing = re.search(r"([\d.]+) pence daily standing charge", cell)
            if not unit or not standing:
                raise ValueError("Ofgem table units changed.")
            for metric, value, label in (
                ("UNIT", unit[1], "pence_per_kwh"),
                ("STANDING", standing[1], "pence_per_day"),
            ):
                rows.append(
                    _row(
                        f"GB.OFGEM.{item[0].upper()}.{metric}.DD",
                        start,
                        float(value),
                        effective_end=end,
                        fetched_at=fetched_at,
                        source="Ofgem",
                        url=OFGEM_URL,
                        unit=label,
                        license_name="Ofgem copyright and reuse terms",
                    )
                )
    return validate(pl.DataFrame(rows, schema=SCHEMA))


def parse_ons(
    uid: str,
    payload: dict[str, Any],
    *,
    fetched_at: datetime,
    source_url: str,
    unit: str,
) -> pl.DataFrame:
    rows = []
    monthly = bool(payload.get("months"))
    for observation in payload.get("months") or payload.get("years") or []:
        value = observation.get("value", "").strip()
        if not value:
            continue
        ds = datetime.strptime(observation["date"], "%Y %b" if monthly else "%Y").date()
        updated = observation.get("updateDate")
        rows.append(
            _row(
                uid,
                ds,
                float(value),
                fetched_at=fetched_at,
                source="Office for National Statistics",
                url=source_url,
                unit=unit,
                published_at=timestamp(updated) if updated else None,
                basis="ONS observation updateDate"
                if updated
                else "not supplied; first retrieval only",
            )
        )
    return validate(pl.DataFrame(rows, schema=SCHEMA))


def write_snapshot(
    frame: pl.DataFrame,
    *,
    fetched_at: datetime,
    data_dir: Path = DATA_DIR,
    errors: dict[str, str] | None = None,
) -> Path:
    frame = validate(frame)
    if cast(datetime, frame["fetched_at"].max()) > fetched_at:
        raise ValueError("Snapshot timestamp precedes its observations.")
    root = data_dir / "drivers" / "vintages"
    root.mkdir(parents=True, exist_ok=True)
    destination = root / vintage_dir_name(fetched_at)
    destination.mkdir(exist_ok=False)
    frame.write_parquet(destination / "observations.parquet")
    manifest = {
        "schemaVersion": 1,
        "fetchedAt": fetched_at.isoformat(),
        "rows": frame.height,
        "series": sorted(frame["unique_id"].unique().to_list()),
        "errors": errors or {},
        "availability": (
            "Use snapshot and fetched_at for revision-safe availability; "
            "published_at alone is insufficient."
        ),
    }
    (destination / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return destination


def refresh(
    *,
    data_dir: Path = DATA_DIR,
    catalog: Catalog | None = None,
    session: requests.Session | None = None,
) -> Path:
    owns_session = session is None
    session = session or new_session()
    frames: list[pl.DataFrame] = []
    errors: dict[str, str] = {}
    try:
        try:
            catalog = catalog if catalog is not None else discover_catalog(session)
            for code in INDEX_CODES:
                entry = catalog.get(("CPI", code))
                if entry is None or not entry.index_cdid or not entry.weight_cdid:
                    raise ValueError(f"ONS index/weight missing for {code}.")
                for prefix, cdid, unit in (
                    ("INDEX", entry.index_cdid, "index_2015_100"),
                    ("WEIGHT", entry.weight_cdid, "per_mille"),
                ):
                    url = f"https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/{cdid.lower()}/mm23"
                    response = session.get(f"{url}/data", timeout=45)
                    response.raise_for_status()
                    frames.append(
                        parse_ons(
                            f"GB.{prefix}.{code}",
                            response.json(),
                            fetched_at=datetime.now(UTC),
                            source_url=url,
                            unit=unit,
                        )
                    )
        except (requests.RequestException, ValueError, KeyError) as exc:
            errors["ons"] = str(exc)
        try:
            response = session.get(FUEL_API, timeout=45)
            response.raise_for_status()
            content = response.json()
            urls = [
                a["url"]
                for a in content["details"]["attachments"]
                if a.get("content_type") == "text/csv"
            ]
            if not urls:
                raise ValueError("No DESNZ CSV attachments.")
            fuel_frames = []
            for url in urls:
                response = session.get(url, timeout=45)
                response.raise_for_status()
                fuel_frames.append(
                    parse_fuel_csv(
                        response.content.decode("utf-8-sig"),
                        content,
                        fetched_at=datetime.now(UTC),
                        source_url=url,
                    )
                )
            # Attachment overlap is acceptable only for identical values.
            fuel = pl.concat(fuel_frames)
            if (
                cast(int, fuel.group_by("unique_id", "ds").agg(pl.col("y").n_unique())["y"].max())
                > 1
            ):
                raise ValueError("Conflicting overlapping DESNZ attachments.")
            frames.append(fuel.unique(["unique_id", "ds"], keep="last"))
        except (requests.RequestException, ValueError, KeyError) as exc:
            errors["fuel"] = str(exc)
        try:
            response = session.get(OFGEM_URL, timeout=45)
            response.raise_for_status()
            frames.append(parse_ofgem(response.text, fetched_at=datetime.now(UTC)))
        except (requests.RequestException, ValueError) as exc:
            errors["ofgem"] = str(exc)
        for source, error in errors.items():
            LOGGER.warning("Driver source %s unavailable: %s", source, error)
        if not frames:
            raise ValueError("All driver sources failed; no snapshot written.")
        return write_snapshot(
            pl.concat(frames),
            fetched_at=datetime.now(UTC),
            data_dir=data_dir,
            errors=errors,
        )
    finally:
        if owns_session:
            session.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    args = parser.parse_args()
    print(refresh(data_dir=args.data_dir))


if __name__ == "__main__":
    main()
